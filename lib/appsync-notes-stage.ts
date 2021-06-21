import { CfnOutput, Construct, Stage, StageProps } from '@aws-cdk/core';
import { AppsyncNotesStack } from './appsync-notes-stack';

export class AppsyncNotesStage extends Stage {
  public readonly urlOutput: CfnOutput;
  public readonly apiKey: CfnOutput;

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const application = new AppsyncNotesStack(this, 'AppsyncNotes');
  }
}
