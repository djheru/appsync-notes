import { AuthorizationType, BaseResolverProps, GraphqlApi, Schema } from '@aws-cdk/aws-appsync';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { CfnOutput, Construct, Duration, Expiration, Stack, StackProps } from '@aws-cdk/core';

export interface ApiDatasourceConfig {
  id: string;
  resolvers: BaseResolverProps[];
  lambdaFunction: NodejsFunction;
}

export class AppsyncNotesApiStack extends Stack {
  public apiUrl: string;
  public apiKey: string;
  public api: GraphqlApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    this.buildResources();
  }

  private buildResources() {
    this.buildApi();
    this.buildCfnOutputs();
  }

  private buildApi() {
    this.api = new GraphqlApi(this, 'AppSyncNotesApi', {
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
    this.apiUrl = this.api.graphqlUrl;
    this.apiKey = this.api.apiKey || '';
  }

  private buildCfnOutputs() {
    new CfnOutput(this, 'AppSyncNotesApiUrl', {
      value: this.apiUrl,
    });

    new CfnOutput(this, 'AppSyncNotesApiKey', {
      value: this.apiKey,
    });
  }

  public registerDatasource(datasource: ApiDatasourceConfig) {
    const lambdaDatasource = this.api.addLambdaDataSource(datasource.id, datasource.lambdaFunction);
    for (const config of datasource.resolvers) {
      lambdaDatasource.createResolver(config);
    }
  }
}
