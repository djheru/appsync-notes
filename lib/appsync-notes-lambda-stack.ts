import { SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';
import { Runtime } from '@aws-cdk/aws-lambda';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { Stack, StackProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ApiDatasourceConfig } from './appsync-notes-api-stack';

export interface AppsyncNotesLambdaStackProps extends StackProps {
  vpc: Vpc;
  securityGroups: SecurityGroup[];
  environmentVariables: Record<string, string>;
}
export class AppsyncNotesLambdaStack extends Stack {
  public id: string;
  public lambdaFunction: NodejsFunction;
  private vpc: Vpc;
  private securityGroups: SecurityGroup[];
  private environmentVariables: Record<string, string>;

  constructor(scope: Construct, id: string, props: AppsyncNotesLambdaStackProps) {
    super(scope, id);

    const { vpc, securityGroups, environmentVariables } = props;

    this.id = id;
    this.vpc = vpc;
    this.securityGroups = securityGroups;
    this.environmentVariables = environmentVariables;

    this.buildResources();
  }

  private buildResources() {
    this.buildLambdaFunction();
  }

  private buildLambdaFunction() {
    const lambdaFunctionId = `${this.id}-lambda-function`;
    this.lambdaFunction = new NodejsFunction(this, lambdaFunctionId, {
      runtime: Runtime.NODEJS_12_X,
      entry: 'src/handler.ts',
      handler: 'handler',
      vpc: this.vpc,
      securityGroups: this.securityGroups,
      environment: this.environmentVariables,
    });
  }

  public getDatasourceConfig(): ApiDatasourceConfig {
    const datasourceConfigId = `${this.id}-datasource`;
    const resolvers = [
      { typeName: 'Query', fieldName: 'listNotes' },
      { typeName: 'Query', fieldName: 'getNoteById' },
      { typeName: 'Mutation', fieldName: 'createNote' },
      { typeName: 'Mutation', fieldName: 'updateNote' },
      { typeName: 'Mutation', fieldName: 'deleteNote' },
    ];
    return {
      id: datasourceConfigId,
      resolvers,
      lambdaFunction: this.lambdaFunction,
    };
  }
}
