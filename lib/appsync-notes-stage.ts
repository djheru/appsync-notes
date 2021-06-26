import { CfnOutput, Construct, Stage, StageProps } from '@aws-cdk/core';
import { AppsyncNotesApiStack } from './appsync-notes-api-stack';
import { AppsyncNotesDbStack } from './appsync-notes-db-stack';
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

    const dbStackId = `${id}-db`;
    const dbStack = new AppsyncNotesDbStack(this, dbStackId, {
      databaseUsername: 'syscdk',
    });

    const lambdaStackId = `${id}-lambda-stack`;
    const lambdaStack = new AppsyncNotesLambdaStack(this, lambdaStackId, {
      vpc: dbStack.vpc,
      securityGroups: [dbStack.connectionToRDSProxySG],
      environmentVariables: {
        DB_PROXY_ENDPOINT: dbStack.databaseProxy.endpoint,
        DB_CREDENTIALS_SECRET: dbStack.databaseCredentialsSecretId,
      },
    });

    apiStack.registerDatasource(lambdaStack.getDatasourceConfig());

    dbStack.databaseCredentialsSecret.grantRead(lambdaStack.lambdaFunction);
  }
}
