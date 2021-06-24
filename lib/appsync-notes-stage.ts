import { CfnOutput, Construct, Stage, StageProps } from '@aws-cdk/core';
import { AppsyncNotesApiStack } from './appsync-notes-api-stack';

export class AppsyncNotesStage extends Stage {
  public readonly urlOutput: CfnOutput;
  public readonly apiKey: CfnOutput;

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const apiStack = new AppsyncNotesApiStack(this, 'AppsyncNotes');
  }
}
