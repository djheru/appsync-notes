import { AuthorizationType, GraphqlApi, Schema } from '@aws-cdk/aws-appsync';
import {
  CfnOutput,
  Construct,
  Duration,
  Expiration,
  RemovalPolicy,
  Stack,
  StackProps,
} from '@aws-cdk/aws-codestarnotifications/node_modules/@aws-cdk/core';
import {
  BastionHostLinux,
  InstanceClass,
  InstanceSize,
  InstanceType,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from '@aws-cdk/aws-ec2';
import { Runtime } from '@aws-cdk/aws-lambda';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import {
  CfnDBProxyTargetGroup,
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  DatabaseProxy,
  PostgresEngineVersion,
} from '@aws-cdk/aws-rds';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { paramCase, pascalCase } from 'change-case';

export interface AppsyncNotesStackProps extends StackProps {
  databaseUsername: string;
  apiName: string;
  defaultDatabaseName?: string;
  deletionProtection?: boolean;
  instanceType?: InstanceType;
  maxAzs?: number;
  removalPolicy?: RemovalPolicy;
}

export class AppsyncNotesStack extends Stack {
  public id: string;
  private props: AppsyncNotesStackProps;

  // VPC Resources
  public vpc: Vpc;
  public connectToRdsProxySg: SecurityGroup;
  public connectToRdsDbSg: SecurityGroup;
  public bastionHost: BastionHostLinux;

  // DB Instance Resources
  public databaseCredentialsSecret: Secret;
  public databaseCredentialsSecretName: string;
  public databaseInstance: DatabaseInstance;
  public databaseProxy: DatabaseProxy;
  public databaseProxyEndpoint: string;

  // AppSync API Resources
  public api: GraphqlApi;
  public apiUrl: string;
  public apiKey: string;

  // Lambda Datasource Resources
  public lambdaFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: AppsyncNotesStackProps) {
    super(scope, id);

    this.id = id;
    this.props = props;
    this.buildResources();
  }

  buildResources() {
    this.buildVpc();
    this.buildSecurityGroups();
    this.buildBastionHost();
    this.buildDatabaseCredentialsSecret();
    this.buildDatabaseInstance();
    this.buildLambdaFunction();
    this.buildGraphqlApi();
  }

  buildVpc() {
    const vpcId = 'Vpc';
    this.vpc = new Vpc(this, vpcId, {
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: this.props.maxAzs || 2,
    });
  }

  buildSecurityGroups() {
    const connectToRdsProxySgId = pascalCase(`rds-proxy-sg`);
    this.connectToRdsProxySg = new SecurityGroup(this, connectToRdsProxySgId, {
      vpc: this.vpc,
    });

    const connectToRdsDbSgId = pascalCase(`rds-db-sg`);
    this.connectToRdsDbSg = new SecurityGroup(this, connectToRdsDbSgId, {
      vpc: this.vpc,
    });

    this.connectToRdsDbSg.addIngressRule(
      this.connectToRdsDbSg,
      Port.tcp(5432),
      'Allow connections to RDS DB from application'
    );
    this.connectToRdsDbSg.addIngressRule(
      this.connectToRdsProxySg,
      Port.tcp(5432),
      'Allow connections to RDS DB from proxy'
    );
  }

  buildBastionHost() {
    const bastionHostId = pascalCase(`bastion-host`);
    this.bastionHost = new BastionHostLinux(this, bastionHostId, {
      vpc: this.vpc,
      instanceName: bastionHostId,
      subnetSelection: {
        subnetType: SubnetType.PUBLIC,
      },
      securityGroup: this.connectToRdsProxySg,
    });

    const bastionHostOutputId = pascalCase(`output-bastion-hostname`);
    new CfnOutput(this, bastionHostOutputId, {
      value: this.bastionHost.instancePublicDnsName,
    });
  }

  buildDatabaseCredentialsSecret() {
    const databaseCredentialsSecretId = pascalCase('db-secret');
    this.databaseCredentialsSecretName = pascalCase(`${this.id}-${databaseCredentialsSecretId}`);
    this.databaseCredentialsSecret = new Secret(this, databaseCredentialsSecretId, {
      secretName: this.databaseCredentialsSecretName,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: this.props.databaseUsername }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
      },
    });
  }

  buildDatabaseInstance() {
    const databaseInstanceId = pascalCase(`db-instance`);
    this.databaseInstance = new DatabaseInstance(this, databaseInstanceId, {
      deletionProtection: this.props.deletionProtection || false,
      removalPolicy: this.props.removalPolicy || RemovalPolicy.DESTROY,
      databaseName: this.props.defaultDatabaseName || 'notes',
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_12_6,
      }),
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      instanceIdentifier: paramCase(`${this.props.apiName}-db`),
      credentials: Credentials.fromSecret(this.databaseCredentialsSecret),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE,
      },
      securityGroups: [this.connectToRdsDbSg],
    });
  }

  buildDatabaseProxy() {
    const databaseProxyId = pascalCase(`db-proxy`);
    this.databaseProxy = this.databaseInstance.addProxy(databaseProxyId, {
      secrets: [this.databaseCredentialsSecret],
      debugLogging: true,
      vpc: this.vpc,
      securityGroups: [this.connectToRdsDbSg],
    });

    const targetGroup = this.databaseProxy.node.children.find((child: any) => {
      return child instanceof CfnDBProxyTargetGroup;
    }) as CfnDBProxyTargetGroup;

    targetGroup.addPropertyOverride('TargetGroupName', 'default');
    this.databaseProxyEndpoint = this.databaseProxy.endpoint;

    const rdsProxyOutputId = pascalCase(`${this.id}-output-rds-proxy-endpoint`);
    new CfnOutput(this, rdsProxyOutputId, {
      value: this.databaseProxy.endpoint,
    });

    const rdsDbOutputId = pascalCase(`${this.id}-output-rds-db-endpoint`);
    new CfnOutput(this, rdsDbOutputId, {
      value: this.databaseInstance.instanceEndpoint.hostname,
    });
  }

  buildLambdaFunction() {
    const lambdaFunctionId = pascalCase(`datasource`);
    const lambdaFunctionName = pascalCase(`${this.props.apiName}-${lambdaFunctionId}`);
    this.lambdaFunction = new NodejsFunction(this, lambdaFunctionId, {
      functionName: lambdaFunctionName,
      runtime: Runtime.NODEJS_12_X,
      entry: 'src/handler.ts',
      handler: 'handler',
      vpc: this.vpc,
      securityGroups: [this.connectToRdsProxySg],
      environment: {
        PROXY_ENDPOINT: this.databaseProxyEndpoint,
        RDS_SECRET_NAME: this.databaseCredentialsSecretName,
      },
    });
    this.databaseCredentialsSecret.grantRead(this.lambdaFunction);
  }

  private buildGraphqlApi() {
    const apiId = pascalCase(`graphql-api`);
    this.api = new GraphqlApi(this, apiId, {
      name: this.props.apiName,
      schema: Schema.fromAsset('graphql/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: Expiration.after(Duration.days(365)),
          },
        },
      },
    });

    //
    this.apiUrl = this.api.graphqlUrl;
    this.apiKey = this.api.apiKey || '';

    const apiDatasourceId = pascalCase(`graphql-datasource`);
    const datasource = this.api.addLambdaDataSource(apiDatasourceId, this.lambdaFunction);

    const resolvers = [
      { typeName: 'Query', fieldName: 'listNotes' },
      { typeName: 'Query', fieldName: 'getNoteById' },
      { typeName: 'Mutation', fieldName: 'createNote' },
      { typeName: 'Mutation', fieldName: 'updateNote' },
      { typeName: 'Mutation', fieldName: 'deleteNote' },
    ];

    resolvers.forEach((resolver) => {
      datasource.createResolver(resolver);
    });

    const urlOutputId = pascalCase(`output-url`);
    const urlExportId = pascalCase(`${this.id}-${urlOutputId}`);
    new CfnOutput(this, urlOutputId, {
      exportName: urlExportId,
      value: this.apiUrl,
    });

    const apiKeyOutputId = pascalCase(`output-api-key`);
    const apiKeyExportId = pascalCase(`${this.id}-${apiKeyOutputId}`);
    new CfnOutput(this, apiKeyOutputId, {
      exportName: apiKeyExportId,
      value: this.apiKey,
    });
  }
}
