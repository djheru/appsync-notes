import { CfnOutput, Construct, Stage, StageProps } from '@aws-cdk/core';
import { AppsyncNotesApiStack } from './appsync-notes-api-stack';
import { AppsyncNotesLambdaStack } from './appsync-notes-lambda-stack';

export class AppsyncNotesStage extends Stage {
  public readonly urlOutput: CfnOutput;
  public readonly apiKey: CfnOutput;

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const apiName = `${id}-api`;
    const apiStackId = `${apiName}-stack`;
    const apiStack = new AppsyncNotesApiStack(this, apiStackId, {
      apiName,
    });

    const vpcStackId = `${id}-vpc`;

    // const lambdaStackId = `${id}-lambda-stack`;
    // const lambdaStack = new AppsyncNotesLambdaStack(this, lambdaStackId);
  }
}
