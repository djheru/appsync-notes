import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { CdkPipeline } from '@aws-cdk/pipelines';

export interface PipelineStackProps extends StackProps {
  // The branch we will be deploying from
  branch: string;
  // Name of the GitHub repo
  repo: string;
  // The username of the repo owner
  owner: string;
  // e.g. dev, test, prod, etc
  stageName: string;
  // AWS Account
  account: string;
  // AWS Region
  region: string;
  // An array of bash commands that can be executed to test the deployment
  testCommands?: string[];
}

export class PipelineStack extends Stack {
  // Reference to the passed-in props
  private props: PipelineStackProps;

  // The output artifact created by the source action (code from the repo)
  private sourceArtifact: Artifact;

  // The output artifact from the synth action (holds the cdk.out directory)
  private cloudAssemblyArtifact: Artifact;

  // The pipeline that runs the operations
  private pipeline: CdkPipeline;

  // Pipeline name
  private pipelineName: string;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    this.props = props;
    this.pipelineName = `${props.repo}-${props.stageName}`;

    this.buildResources();
  }

  private buildResources() {
    this.buildArtifacts();
  }

  private buildArtifacts() {
    this.sourceArtifact = new Artifact(`${this.pipelineName}-sourceArtifact`);
    this.cloudAssemblyArtifact = new Artifact(`${this.pipelineName}-cloudAssemblyArtifact`);
  }
}
