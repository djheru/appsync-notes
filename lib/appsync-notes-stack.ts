import { AuthorizationType, GraphqlApi, Schema } from '@aws-cdk/aws-appsync';
import { CfnOutput, Construct, Duration, Expiration, Stack, StackProps } from '@aws-cdk/core';

export class AppsyncNotesStack extends Stack {
  public apiUrl: string;
  public apiKey: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const api = new GraphqlApi(this, 'AppSyncNotesApi', {
      name: 'appsync-notes-api',
      schema: Schema.fromAsset('graphql/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: Expiration.after(Duration.days(365)),
          },
        },
      },
    });
    this.apiUrl = api.graphqlUrl;
    this.apiKey = api.apiKey || '';

    new CfnOutput(this, 'AppSyncNotesApiUrl', {
      value: this.apiUrl,
    });

    new CfnOutput(this, 'AppSyncNotesApiKey', {
      value: this.apiKey,
    });
  }
}
