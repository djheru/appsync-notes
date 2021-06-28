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
  AuroraPostgresEngineVersion,
  CfnDBProxyTargetGroup,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
  DatabaseProxy,
} from '@aws-cdk/aws-rds';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { pascalCase } from 'change-case';

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

  // DB Cluster Resources
  public databaseCredentialsSecret: Secret;
  public databaseCredentialsSecretId: string;
  public databaseCluster: DatabaseCluster;
  public databaseProxy: DatabaseProxy;

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
    this.buildDatabaseCluster();
    this.buildLambdaFunction();
    this.buildApiGateway();
    this.buildCfnOutputs();
  }

  buildVpc() {
    const vpcId = pascalCase(`${this.id}-vpc`);
    this.vpc = new Vpc(this, vpcId, {
      enableDnsHostnames: true,
      maxAzs: this.props.maxAzs || 2,
    });
  }

  buildSecurityGroups() {
    const connectToRdsProxySgId = pascalCase(`${this.id}-rds-proxy-sg`);
    this.connectToRdsProxySg = new SecurityGroup(this, connectToRdsProxySgId, {
      vpc: this.vpc,
    });

    const connectToRdsDbSgId = pascalCase(`${this.id}-rds-db-sg`);
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
    const bastionHostId = pascalCase(`${this.id}-bastion-host`);
    this.bastionHost = new BastionHostLinux(this, bastionHostId, {
      vpc: this.vpc,
      instanceName: bastionHostId,
      subnetSelection: {
        subnetType: SubnetType.PUBLIC,
      },
      securityGroup: this.connectToRdsProxySg,
    });
  }

  buildDatabaseCredentialsSecret() {
    this.databaseCredentialsSecretId = pascalCase(`${this.id}-db-secret`);
    this.databaseCredentialsSecret = new Secret(this, this.databaseCredentialsSecretId, {
      secretName: this.databaseCredentialsSecretId,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: this.props.databaseUsername }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
      },
    });
  }

  buildDatabaseCluster() {
    const databaseClusterId = pascalCase(`${this.id}-cluster`);
    this.databaseCluster = new DatabaseCluster(this, databaseClusterId, {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_10_14,
      }),
      credentials: Credentials.fromSecret(this.databaseCredentialsSecret),
      instanceProps: {
        instanceType:
          this.props.instanceType || InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MEDIUM),
        vpc: this.vpc,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE,
        },
        securityGroups: [this.connectToRdsDbSg],
      },
      deletionProtection: this.props.deletionProtection || false,
      removalPolicy: this.props.removalPolicy || RemovalPolicy.DESTROY,
      defaultDatabaseName: this.props.defaultDatabaseName || 'notes',
    });
  }

  buildDatabaseProxy() {
    const databaseProxyId = pascalCase(`${this.id}-proxy`);
    this.databaseProxy = this.databaseCluster.addProxy(databaseProxyId, {
      secrets: [this.databaseCredentialsSecret],
      debugLogging: true,
      vpc: this.vpc,
      securityGroups: [this.connectToRdsDbSg],
    });

    const targetGroup = this.databaseProxy.node.children.find((child: any) => {
      return child instanceof CfnDBProxyTargetGroup;
    }) as CfnDBProxyTargetGroup;

    targetGroup.addPropertyOverride('TargetGroupName', 'default');
  }

  buildLambdaFunction() {
    const lambdaFunctionId = pascalCase(`${this.id}-function`);
    this.lambdaFunction = new NodejsFunction(this, lambdaFunctionId, {
      runtime: Runtime.NODEJS_12_X,
      entry: 'src/handler.ts',
      handler: 'handler',
      vpc: this.vpc,
      securityGroups: [this.connectToRdsProxySg],
      environment: {
        PROXY_ENDPOINT: this.databaseProxy.endpoint,
        RDS_SECRET_NAME: this.databaseCredentialsSecretId,
      },
    });
    this.databaseCredentialsSecret.grantRead(this.lambdaFunction);
  }

  buildApiGateway() {
    const apiId = pascalCase(`${this.id}-graphql-api`);
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
  }

  buildCfnOutputs() {
    const urlOutputId = pascalCase(`${this.id}-output-url`);
    new CfnOutput(this, urlOutputId, {
      value: this.apiUrl,
    });

    const apiKeyOutputId = pascalCase(`${this.id}-output-api-key`);
    new CfnOutput(this, apiKeyOutputId, {
      value: this.apiKey,
    });

    const bastionHostOutputId = pascalCase(`${this.id}-output-bastion-hostname`);
    new CfnOutput(this, bastionHostOutputId, {
      value: this.bastionHost.instancePublicDnsName,
    });

    const rdsProxyOutputId = pascalCase(`${this.id}-output-rds-proxy-endpoint`);
    new CfnOutput(this, rdsProxyOutputId, {
      value: this.databaseProxy.endpoint,
    });

    const rdsWriteOutputId = pascalCase(`${this.id}-output-rds-write-endpoint`);
    new CfnOutput(this, rdsWriteOutputId, {
      value: this.databaseCluster.clusterEndpoint.hostname,
    });

    const rdsReadOutputId = pascalCase(`${this.id}-output-rds-read-endpoint`);
    new CfnOutput(this, rdsReadOutputId, {
      value: this.databaseCluster.clusterReadEndpoint.hostname,
    });
  }
}
