import { createConnection, Connection } from 'typeorm';
import { SecretsManager } from 'aws-sdk';
import { Note } from '../entities/note.entity';
import cert from './AmazonRootCA1';

const secretsManager = new SecretsManager({ region: process.env.AWS_REGION || 'us-east-1' });
const SecretId = process.env.RDS_SECRET_NAME || '';

let connection: Connection;

export const getConnection = async () => {
  if (connection) {
    console.log(`Returning existing connection`);
    return connection;
  }
  try {
    console.log(`Retrieving secret: ${SecretId}`);
    const secret = await secretsManager.getSecretValue({ SecretId }).promise();
    const { username, password, host } = JSON.parse(<string>secret.SecretString);
    console.log(`Obtained DB credentials: ${username}`);

    connection = await createConnection({
      type: 'postgres',
      host: process.env.PROXY_ENDPOINT,
      ssl: {
        ca: cert,
      },
      username,
      password,
      database: 'notes',
      entities: [Note],
      synchronize: true,
    });
    console.log(`Connection established successfully: ${connection.isConnected}`);
    return connection;
  } catch (e) {
    console.log(`Unable to create connection: ${e.message || e.stack}`);
    throw e;
  }
};
