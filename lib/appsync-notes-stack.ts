import { AuthorizationType, GraphqlApi, Schema } from '@aws-cdk/aws-appsync';
import {
  CfnOutput,
  Construct,
  Duration,
  Expiration,
  RemovalPolicy,
  Stack,
  StackProps,
} from '@aws-cdk/core';
import { AttributeType, BillingMode, Table } from '@aws-cdk/aws-dynamodb';
import { Runtime } from '@aws-cdk/aws-lambda';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { pascalCase } from 'change-case';
import { resolverConfig } from '../src/handler';

export interface AppsyncNotesStackProps extends StackProps {
  apiName: string;
  deletionProtection?: boolean;
  removalPolicy?: RemovalPolicy;
}

export class AppsyncNotesStack extends Stack {
  public id: string;
  private props: AppsyncNotesStackProps;

  // AppSync API Resources
  public api: GraphqlApi;
  public apiUrl: string;
  public apiKey: string;

  // DynamoDB Table
  public table: Table;

  // Lambda Datasource Resources
  public lambdaFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: AppsyncNotesStackProps) {
    super(scope, id);

    this.id = id;
    this.props = props;
    this.buildResources();
  }

  buildResources() {
    this.buildLambdaFunction();
    this.buildGraphqlApi();
    this.buildTable();
  }

  buildLambdaFunction() {
    const lambdaFunctionId = pascalCase(`${this.props.apiName}-datasource`);
    this.lambdaFunction = new NodejsFunction(this, lambdaFunctionId, {
      functionName: lambdaFunctionId,
      runtime: Runtime.NODEJS_12_X,
      entry: 'src/handler.ts',
      handler: 'handler',
      environment: {},
      memorySize: 1024,
    });
  }

  private buildTable() {
    const tableId = pascalCase(`${this.props.apiName}-table`);
    this.table = new Table(this, tableId, {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
    });
    this.table.grantFullAccess(this.lambdaFunction);
    this.lambdaFunction.addEnvironment('NOTES_TABLE', this.table.tableName);
  }

  private buildGraphqlApi() {
    const apiId = pascalCase(`${this.props.apiName}-graphql-api`);
    this.api = new GraphqlApi(this, apiId, {
      name: this.props.apiName,
      schema: Schema.fromAsset('graphql/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: Expiration.after(Duration.days(365)),
          },
        },
      },
      xrayEnabled: true,
    });

    //
    this.apiUrl = this.api.graphqlUrl;
    this.apiKey = this.api.apiKey || '';

    const apiDatasourceId = pascalCase(`${this.props.apiName}-graphql-datasource`);
    const datasource = this.api.addLambdaDataSource(apiDatasourceId, this.lambdaFunction);

    resolverConfig.forEach((resolver) => {
      datasource.createResolver(resolver);
    });

    const urlOutputId = pascalCase(`${this.props.apiName}-output-url`);
    new CfnOutput(this, urlOutputId, {
      exportName: urlOutputId,
      value: this.apiUrl,
    });

    const apiKeyOutputId = pascalCase(`${this.props.apiName}-output-api-key`);
    new CfnOutput(this, apiKeyOutputId, {
      exportName: apiKeyOutputId,
      value: this.apiKey,
    });
  }
}
