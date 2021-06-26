import {
  InstanceClass,
  InstanceSize,
  InstanceType,
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

export interface AppsyncNotesDbStackProps extends StackProps {
  instanceType?: InstanceType;
  deletionProtection?: boolean;
  removalPolicy?: RemovalPolicy;
  defaultDatabaseName?: string;
  databaseUsername: string;
  vpc: Vpc;
  securityGroup: SecurityGroup;
}
export class AppsyncNotesDbStack extends Stack {
  public id: string;
  private props: AppsyncNotesDbStackProps;
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
    this.buildCredentialsSecret();
    this.buildCredentialsSecretArnParameter();
    this.buildDatabaseCluster();
    this.buildDatabaseProxy();
    this.buildCfnOutputs();
  }

  buildCredentialsSecret() {
    this.databaseCredentialsSecretId = `${this.id}-credentials-secret`;
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
    const databaseCredentialsSecretArnParameterId = `${this.id}-credentials-secret-arn`;
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
    const databaseClusterId = `${this.id}-cluster`;
    this.databaseCluster = new DatabaseCluster(this, databaseClusterId, {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_10_14,
      }),
      credentials: Credentials.fromSecret(this.databaseCredentialsSecret),
      instanceProps: {
        instanceType:
          this.props.instanceType || InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MEDIUM),
        vpc: this.props.vpc,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE,
        },
        securityGroups: [this.props.securityGroup],
      },
      deletionProtection: this.props.deletionProtection || false,
      removalPolicy: this.props.removalPolicy || RemovalPolicy.DESTROY,
      defaultDatabaseName: this.props.defaultDatabaseName || 'notes',
    });
  }

  buildDatabaseProxy() {
    const databaseProxyId = `${this.id}-proxy`;
    this.databaseProxy = this.databaseCluster.addProxy(databaseProxyId, {
      secrets: [this.databaseCredentialsSecret],
      debugLogging: true,
      vpc: this.props.vpc,
      securityGroups: [this.props.securityGroup],
    });

    const targetGroup = this.databaseProxy.node.children.find((child: any) => {
      return child instanceof CfnDBProxyTargetGroup;
    }) as CfnDBProxyTargetGroup;

    targetGroup.addPropertyOverride('TargetGroupName', 'default');
  }

  private buildCfnOutputs() {
    const proxyEndpointId = `${this.id}-proxy-endpoint`;
    new CfnOutput(this, proxyEndpointId, {
      value: this.databaseProxy.endpoint,
    });

    const dbCredentialsSecretArnId = `${this.id}-credentials-secret-arn`;
    new CfnOutput(this, dbCredentialsSecretArnId, {
      value: this.databaseCredentialsSecret.secretArn,
    });
  }
}
