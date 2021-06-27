import { AuthorizationType, BaseResolverProps, GraphqlApi, Schema } from '@aws-cdk/aws-appsync';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { CfnOutput, Construct, Duration, Expiration, Stack, StackProps } from '@aws-cdk/core';
import { pascalCase } from 'change-case';

export interface ApiDatasourceConfig {
  id: string;
  resolvers: BaseResolverProps[];
  lambdaFunction: NodejsFunction;
}

export interface AppsyncNotesApiStackProps extends StackProps {
  apiName: string;
}

export class AppsyncNotesApiStack extends Stack {
  public id: string;
  public apiUrl: string;
  public apiKey: string;
  public apiName: string;
  public api: GraphqlApi;

  constructor(scope: Construct, id: string, props: AppsyncNotesApiStackProps) {
    super(scope, id, props);

    this.id = id;
    this.apiName = props.apiName;

    this.buildResources();
  }

  private buildResources() {
    this.buildApi();
    this.buildCfnOutputs();
  }

  private buildApi() {
    const apiId = pascalCase(`${this.id}-graphql-api`);
    this.api = new GraphqlApi(this, apiId, {
      name: this.apiName,
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
    const urlOutputId = pascalCase(`${this.id}-output-url-output`);
    new CfnOutput(this, urlOutputId, {
      value: this.apiUrl,
    });

    const apiKeyOutputId = pascalCase(`${this.id}-output-api-key-output`);
    new CfnOutput(this, apiKeyOutputId, {
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
