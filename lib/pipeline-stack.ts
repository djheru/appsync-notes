import { StackProps } from '@aws-cdk/core';

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
