#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PipelineStack } from '../lib/pipeline-stack';
import { AppsyncNotesStage } from '../lib/appsync-notes-stage';

const { CDK_DEFAULT_ACCOUNT: account, CDK_DEFAULT_REGION: region } = process.env;
const env = { account, region };
const branch = 'main';
const repo = 'appsync-notes';
const owner = 'djheru';
const stageName = 'dev';

const app = new cdk.App();

const pipelineStack = new PipelineStack(app, 'AppsyncNotesPipeline', {
  env,
  branch,
  repo,
  owner,
  stageName,
});

const applicationStage = new AppsyncNotesStage(app, 'AppsyncNotesStage', { env });

pipelineStack.registerApplicationStage({ stage: applicationStage });
pipelineStack.compilePipeline();

app.synth();
