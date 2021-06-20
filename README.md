### Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

#### Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

# AppSync with Lambda, RDS, and CodePipeline CI/CD

## Initial Setup

- `npm i -g aws-cdk`
- `mkdir appsync-rds-lambda-cdk && cd $_`
- `cdk init --language=typescript`

## Install Dependencies

```
npm i \
  @aws-cdk/aws-appsync \
  @aws-cdk/aws-codepipeline \
  @aws-cdk/aws-codepipeline-actions \
  @aws-cdk/aws-lambda \
  @aws-cdk/aws-lambda-nodejs \
  @aws-cdk/aws-ec2 \
  @aws-cdk/aws-rds \
  @aws-cdk/aws-secretsmanager \
  @aws-cdk/aws-ssm \
  @aws-cdk/pipelines \
  aws-lambda aws-sdk \
  pg pg-native typeorm
```

```bash
npm i --save-dev \
  @types/pg \
  eslint \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin \
  prettier \
  eslint-config-prettier \
  eslint-plugin-prettier
```