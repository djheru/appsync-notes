#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AppsyncNotesStack } from '../lib/appsync-notes-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const { CDK_DEFAULT_ACCOUNT: account, CDK_DEFAULT_REGION: region } = process.env;
const env = { account, region };
const branch = 'master';
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

app.synth();
