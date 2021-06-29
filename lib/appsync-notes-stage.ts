import { CfnOutput, Construct, Stage, StageProps, Tags } from '@aws-cdk/core';
import { pascalCase } from 'change-case';
import { AppsyncNotesStack } from './appsync-notes-stack';

export class AppsyncNotesStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const appsyncNotesStackId = pascalCase(`stack`);
    const stack = new AppsyncNotesStack(this, appsyncNotesStackId, {
      stackName: appsyncNotesStackId,
      databaseUsername: 'appsyncadmin',
      apiName: pascalCase(`${id}`),
    });

    Tags.of(stack).add('application', id);
  }
}
