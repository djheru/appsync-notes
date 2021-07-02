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
  Peer,
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
import { pascalCase } from 'change-case';
import { resolverConfig } from '../src/handler';

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
    this.buildDatabaseProxy();
    this.buildLambdaFunction();
    this.buildGraphqlApi();
  }

  buildVpc() {
    const vpcId = pascalCase(`${this.props.apiName}-vpc`);
    this.vpc = new Vpc(this, vpcId, {
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: this.props.maxAzs || 2,
    });
  }

  buildSecurityGroups() {
    const connectToRdsProxySgId = pascalCase(`${this.props.apiName}-rds-proxy-sg`);
    this.connectToRdsProxySg = new SecurityGroup(this, connectToRdsProxySgId, {
      vpc: this.vpc,
    });

    const connectToRdsDbSgId = pascalCase(`${this.props.apiName}-rds-db-sg`);
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
    const bastionHostId = pascalCase(`${this.props.apiName}-bastion-host`);
    this.bastionHost = new BastionHostLinux(this, bastionHostId, {
      vpc: this.vpc,
      instanceName: bastionHostId,
      subnetSelection: {
        subnetType: SubnetType.PUBLIC,
      },
      securityGroup: this.connectToRdsDbSg,
    });

    this.bastionHost.allowSshAccessFrom(Peer.anyIpv4());

    const bastionHostOutputId = pascalCase(`output-bastion-hostname`);
    new CfnOutput(this, bastionHostOutputId, {
      value: this.bastionHost.instancePublicDnsName,
    });
  }

  buildDatabaseCredentialsSecret() {
    this.databaseCredentialsSecretName = pascalCase(`${this.props.apiName}-db-secret`);
    this.databaseCredentialsSecret = new Secret(this, this.databaseCredentialsSecretName, {
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
    const databaseInstanceId = pascalCase(`${this.props.apiName}-db-instance`);
    this.databaseInstance = new DatabaseInstance(this, databaseInstanceId, {
      deletionProtection: this.props.deletionProtection || false,
      removalPolicy: this.props.removalPolicy || RemovalPolicy.DESTROY,
      databaseName: this.props.defaultDatabaseName || 'notes',
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_11,
      }),
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
      instanceIdentifier: pascalCase(`${this.props.apiName}-db`),
      credentials: Credentials.fromSecret(this.databaseCredentialsSecret),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE,
      },
      securityGroups: [this.connectToRdsDbSg],
    });
  }

  buildDatabaseProxy() {
    const databaseProxyId = pascalCase(`${this.props.apiName}-db-proxy`);
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

    const rdsProxyOutputId = pascalCase(`${this.props.apiName}-output-rds-proxy-endpoint`);
    new CfnOutput(this, rdsProxyOutputId, {
      exportName: rdsProxyOutputId,
      value: this.databaseProxy.endpoint,
    });

    const rdsDbOutputId = pascalCase(`${this.props.apiName}-output-rds-db-endpoint`);
    new CfnOutput(this, rdsDbOutputId, {
      exportName: rdsDbOutputId,
      value: this.databaseInstance.instanceEndpoint.hostname,
    });
  }

  buildLambdaFunction() {
    const lambdaFunctionId = pascalCase(`${this.props.apiName}-datasource`);
    this.lambdaFunction = new NodejsFunction(this, lambdaFunctionId, {
      functionName: lambdaFunctionId,
      runtime: Runtime.NODEJS_12_X,
      entry: 'src/handler.ts',
      handler: 'handler',
      vpc: this.vpc,
      securityGroups: [this.connectToRdsProxySg],
      environment: {
        PROXY_ENDPOINT: this.databaseProxyEndpoint,
        RDS_SECRET_NAME: this.databaseCredentialsSecretName,
      },
      timeout: Duration.seconds(60),
    });
    this.databaseCredentialsSecret.grantRead(this.lambdaFunction);
  }

  private buildGraphqlApi() {
    const apiId = pascalCase(`${this.props.apiName}-graphql-api`);
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

    const apiDatasourceId = pascalCase(`${this.props.apiName}-graphql-datasource`);
    const datasource = this.api.addLambdaDataSource(apiDatasourceId, this.lambdaFunction);

    resolverConfig.forEach((resolver) => {
      datasource.createResolver(resolver);
    });

    const urlOutputId = pascalCase(`${this.props.apiName}-output-url`);
    new CfnOutput(this, urlOutputId, {
      exportName: urlOutputId,
      value: this.apiUrl,
    });

    const apiKeyOutputId = pascalCase(`${this.props.apiName}-output-api-key`);
    new CfnOutput(this, apiKeyOutputId, {
      exportName: apiKeyOutputId,
      value: this.apiKey,
    });
  }
}
