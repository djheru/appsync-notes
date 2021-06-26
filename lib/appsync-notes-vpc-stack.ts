import { BastionHostLinux, Peer, Port, SecurityGroup, SubnetType, Vpc } from '@aws-cdk/aws-ec2';
import { Construct, Stack, StackProps } from '@aws-cdk/core';

export interface AppsyncNotesVpcStackProps extends StackProps {
  maxAzs?: number;
}
export class AppsyncNotesVpcStack extends Stack {
  public id: string;
  private props: AppsyncNotesVpcStackProps;
  public vpc: Vpc;
  public connectionToRDSProxySG: SecurityGroup;
  public connectionToRDSDBSG: SecurityGroup;
  public bastionHost: BastionHostLinux;

  constructor(scope: Construct, id: string, props: AppsyncNotesVpcStackProps) {
    super(scope, id, props);

    this.id = id;
    this.props = props;
    this.buildResources();
  }

  buildResources() {
    this.buildVpc();
    this.buildSecurityGroups();
    this.buildBastionHost();
  }

  buildVpc() {
    this.vpc = new Vpc(this, this.id, {
      maxAzs: this.props.maxAzs || 2,
    });
  }

  buildSecurityGroups() {
    const connectionToRDSProxySGId = `${this.id}-rds-proxy-sg`;
    this.connectionToRDSProxySG = new SecurityGroup(this, connectionToRDSProxySGId, {
      vpc: this.vpc,
    });

    const connectionToRDSDBSGId = `${this.id}-rds-db-sg`;
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
    const bastionHostId = `${this.id}-bastion-host`;
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
}
