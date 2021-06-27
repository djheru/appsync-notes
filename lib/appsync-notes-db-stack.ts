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
import {
  AuroraPostgresEngineVersion,
  CfnDBProxyTargetGroup,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
  DatabaseProxy,
} from '@aws-cdk/aws-rds';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { StringParameter } from '@aws-cdk/aws-ssm';
import { CfnOutput, Construct, RemovalPolicy, Stack, StackProps } from '@aws-cdk/core';
import { pascalCase } from 'change-case';

export interface AppsyncNotesDbStackProps extends StackProps {
  instanceType?: InstanceType;
  deletionProtection?: boolean;
  removalPolicy?: RemovalPolicy;
  defaultDatabaseName?: string;
  databaseUsername: string;
  maxAzs?: number;
}
export class AppsyncNotesDbStack extends Stack {
  public id: string;
  private props: AppsyncNotesDbStackProps;
  public vpc: Vpc;
  public connectionToRDSProxySG: SecurityGroup;
  public connectionToRDSDBSG: SecurityGroup;
  public bastionHost: BastionHostLinux;
  public databaseCredentialsSecretId: string;
  public databaseCredentialsSecret: Secret;
  public databaseCredentialsSecretArnParameter: StringParameter;
  public databaseCluster: DatabaseCluster;
  public databaseProxy: DatabaseProxy;

  constructor(scope: Construct, id: string, props: AppsyncNotesDbStackProps) {
    super(scope, id, props);

    this.id = id;
    this.props = props;
    this.buildResources();
  }

  buildResources() {
    this.buildVpc();
    this.buildSecurityGroups();
    this.buildBastionHost();
    this.buildCredentialsSecret();
    this.buildCredentialsSecretArnParameter();
    this.buildDatabaseCluster();
    this.buildDatabaseProxy();
    this.buildCfnOutputs();
  }

  buildVpc() {
    this.vpc = new Vpc(this, this.id, {
      maxAzs: this.props.maxAzs || 2,
    });
  }

  buildSecurityGroups() {
    const connectionToRDSProxySGId = pascalCase(`${this.id}-rds-proxy-sg`);
    this.connectionToRDSProxySG = new SecurityGroup(this, connectionToRDSProxySGId, {
      vpc: this.vpc,
    });

    const connectionToRDSDBSGId = pascalCase(`${this.id}-rds-db-sg`);
    this.connectionToRDSDBSG = new SecurityGroup(this, connectionToRDSDBSGId, {
      vpc: this.vpc,
    });

    this.connectionToRDSDBSG.addIngressRule(
      this.connectionToRDSDBSG,
      Port.tcp(5432),
      `Allow DB connection`
    );
    this.connectionToRDSDBSG.addIngressRule(
      this.connectionToRDSProxySG,
      Port.tcp(5432),
      'Allow application connections'
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
      securityGroup: this.connectionToRDSProxySG,
    });
    this.bastionHost.allowSshAccessFrom(Peer.anyIpv4());
  }

  buildCredentialsSecret() {
    this.databaseCredentialsSecretId = pascalCase(`${this.id}-credentials-secret`);
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

  buildCredentialsSecretArnParameter() {
    const databaseCredentialsSecretArnParameterId = pascalCase(`${this.id}-credentials-secret-arn`);
    this.databaseCredentialsSecretArnParameter = new StringParameter(
      this,
      databaseCredentialsSecretArnParameterId,
      {
        parameterName: databaseCredentialsSecretArnParameterId,
        stringValue: this.databaseCredentialsSecret.secretArn,
      }
    );
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
        securityGroups: [this.connectionToRDSDBSG],
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
      securityGroups: [this.connectionToRDSDBSG],
    });

    const targetGroup = this.databaseProxy.node.children.find((child: any) => {
      return child instanceof CfnDBProxyTargetGroup;
    }) as CfnDBProxyTargetGroup;

    targetGroup.addPropertyOverride('TargetGroupName', 'default');
  }

  private buildCfnOutputs() {
    const proxyEndpointId = pascalCase(`${this.id}-proxy-endpoint-output`);
    new CfnOutput(this, proxyEndpointId, {
      value: this.databaseProxy.endpoint,
    });

    const dbCredentialsSecretArnId = pascalCase(`${this.id}-credentials-secret-arn-output`);
    new CfnOutput(this, dbCredentialsSecretArnId, {
      value: this.databaseCredentialsSecret.secretArn,
    });
  }
}
