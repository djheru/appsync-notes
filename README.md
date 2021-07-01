### Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

#### Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

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

## Configure Linting

- Create `.eslintrc.js` file

```json
module.exports = {
  parser: "@typescript-eslint/parser", // Specifies the ESLint parser
  parserOptions: {
    ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
    sourceType: "module", // Allows for the use of imports
  },
  extends: [
    "plugin:@typescript-eslint/recommended", // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    "prettier/@typescript-eslint", // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
    "plugin:prettier/recommended" // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  rules: {
    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // e.g. "@typescript-eslint/explicit-function-return-type": "off",
  },
};
```

- create `.prettierrc.js` file

```json
module.exports = {
  semi: true,
  trailingComma: "es5",
  singleQuote: true,
  printWidth: 108,
  tabWidth: 2
};
```

- Ensure that eslint has `prettierrc.js` as the prettier config file name

## Set up CDK Stack

### Set up Github Token

- Go to GitHub->Settings->Developer Settings->Personal access tokens
- Generate new token, with name like "cdk-pipelines-demo"
- Give `repo` and `admin:repo_hook` permissions

### Add Secret to AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name github-token \
  --secret-string 'the token'
```

Example response

```bash
{
    "ARN": "arn:aws:secretsmanager:us-east-1:205375198116:secret:github-token-h3nIdi",
    "Name": "github-token",
    "VersionId": "a2a94c65-53ee-4073-926c-0b78bc88dd7e"
}
```

### CDK Stack organization

- CDK App instantiates the Pipeline stack
- The Pipeline stack consists of CDKPipeline
- The pipeline consists of stages
- Stages con actions
- 4 stages by default
  - Source (e.g. github)
  - Build (CDK synth/npm run build)
  - Update Pipeline (Self mutate)
  - Assets - (Publish artifacts)
- The stage contains an instance of our application stack (appsync-notes-stack)
- Application stack contains our resources for our application (lambdas, apis, dbs, vpcs, etc)

## Connect to DB via Bastion Host

Typically, it's more convenient to use some type of GUI-based software to perform queries on the db.
The problem is, the DB is in a private network, so we can't connect directly. Fortunately, we created
an EC2 instance in our stack that does allow SSH access from the public internet, so we can connect
to the instance, and then connect to the DB from there.

We don't want to worry about managing SSH keys on the instance, so we'll use the `aws ec2-instance-connect send-ssh-public-key`
CLI command. This will upload a key that you specify to the EC2 instance for a short time, allowing you to connect (assuming you have IAM permissions to do so)

We've included a bash script to make this easier. Simply run the script with a command like `./scripts/db-tunnel.sh AppsyncNotesDev ~/.ssh/cdk_key` and the script will upload

```shell
You may now connect to the remote database using SSH tunneling


RDS HOST: appsyncnotesdevdb.czahfmvf7ofn.us-east-1.rds.amazonaws.com
RDS USERNAME: appsyncadmin
RDS PASSWORD: AAAVf1MPTNxL32c2VWK8rim5RatWaIsB
RDS PORT: 5432
RDS DB NAME: notes


SSH HOST: 54.9.62.33
SSH USER: ec2-user
SSH KEY: /Users/philipdamra/.ssh/cdk_key
```
