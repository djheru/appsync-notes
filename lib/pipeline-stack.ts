import { Construct, SecretValue, Stack, StackProps, Stage } from '@aws-cdk/core';
import { Action, Artifact } from '@aws-cdk/aws-codepipeline';
import { CdkPipeline, SimpleSynthAction } from '@aws-cdk/pipelines';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';

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
  // Application stages to add to the pipeline
  applicationStages?: ApplicationStageConfig[];
}

export interface ApplicationStageConfig {
  stage: Stage;
  actions?: Action[];
}

export class PipelineStack extends Stack {
  // The name of the SSM secret containing the GitHub key
  private static GITHUB_SECRET_ID = 'github-token';

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

  private applicationStages: ApplicationStageConfig[] = [];

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    this.props = props;
    this.pipelineName = `${props.repo}-${props.stageName}`;

    // Application stages can be specified at instantiation or after, using registerApplicationStage
    if (props.applicationStages) {
      this.applicationStages = props.applicationStages;
    }

    this.buildResources();
  }

  private buildResources() {
    this.buildArtifacts();
    this.buildPipeline();
  }

  private buildArtifacts() {
    this.sourceArtifact = new Artifact(`${this.pipelineName}-sourceArtifact`);
    this.cloudAssemblyArtifact = new Artifact(`${this.pipelineName}-cloudAssemblyArtifact`);
  }

  private buildPipeline() {
    const pipelineId = `${this.pipelineName}-pipeline`;
    this.pipeline = new CdkPipeline(this, pipelineId, {
      pipelineName: this.pipelineName,
      cloudAssemblyArtifact: this.cloudAssemblyArtifact, // Stores CDK build output
      sourceAction: new GitHubSourceAction({
        // Gets the source code from GitHub
        actionName: `${this.pipelineName}-github-source`,
        output: this.sourceArtifact, // Check out the repo files into the source Artifact
        oauthToken: SecretValue.secretsManager(PipelineStack.GITHUB_SECRET_ID), // Token to get access to repo
        owner: this.props.owner,
        repo: this.props.repo,
        branch: this.props.branch,
      }),
      synthAction: SimpleSynthAction.standardNpmSynth({
        sourceArtifact: this.sourceArtifact, // Gets the source code from the source Artifact
        buildCommand: 'npm run build', // Whatever build command your application code needs
        cloudAssemblyArtifact: this.cloudAssemblyArtifact, // Saves the build output to the cloudAssembly Artifact
      }),
    });
  }

  public registerApplicationStage(stage: ApplicationStageConfig) {
    this.applicationStages.push(stage);
  }

  public compilePipeline() {
    if (this.applicationStages.length > 0) {
      for (const stageConfig of this.applicationStages) {
        const pipelineStage = this.pipeline.addApplicationStage(stageConfig.stage);
        if (stageConfig.actions) {
          for (const action of stageConfig.actions) {
            pipelineStage.addActions(action);
          }
        }
      }
    }
  }
}
