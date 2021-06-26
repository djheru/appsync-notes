#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PipelineStack } from '../lib/pipeline-stack';
import { AppsyncNotesStage } from '../lib/appsync-notes-stage';

const {
  CDK_DEFAULT_ACCOUNT: account,
  CDK_DEFAULT_REGION: region,
  CDK_PIPIELINE_GIT_REPO: repo = 'appsync-notes',
  CDK_PIPELINE_GIT_BRANCH: branch = 'main',
  CDK_PIPELINE_GIT_OWNER: owner = 'djheru',
  CDK_PIPELINE_STAGE_NAME: stage = 'dev',
} = process.env;

const env = { account, region };

const app = new cdk.App();

const baseId = `${repo}-${stage}`;

const pipelineStackId = `${baseId}-pipeline`;
const pipelineStack = new PipelineStack(app, pipelineStackId, {
  env,
  branch,
  repo,
  owner,
});

const applicationStageId = `${baseId}`;
const applicationStage = new AppsyncNotesStage(app, applicationStageId, { env });

pipelineStack.registerApplicationStage({ stage: applicationStage });

app.synth();
