import { DynamoDB } from 'aws-sdk';
import { AppSyncEvent } from './handler';
import { UpdateItemInput } from 'aws-sdk/clients/dynamodb';

const docClient = new DynamoDB.DocumentClient();

const { NOTES_TABLE: TableName = '' } = process.env;
export interface ResolverMapping {
  typeName: string;
  handler: (event: AppSyncEvent) => any;
}

type UpdateParams = {
  TableName: string;
  Key: string | {};
  ExpressionAttributeValues: any;
  ExpressionAttributeNames: any;
  UpdateExpression: string;
  ReturnValues: string;
};

export const listNotes = async (event: AppSyncEvent) => {
  try {
    console.log('listNotes event: %j', event);
    const params = {
      TableName,
    };
    const result = await docClient.scan(params).promise();
    const { Items: notes } = result;
    console.log('listNotes result: %j', result);
    return notes;
  } catch (e) {
    console.log('listNotes error: ', e);
    return null;
  }
};

export const getNoteById = async (event: AppSyncEvent) => {
  try {
    console.log('getNoteById event: %j', event);
    const { noteId: id } = event.arguments;
    const params = {
      TableName,
      Key: {
        id,
      },
    };
    const result = await docClient.get(params).promise();
    const { Item: note } = result;
    console.log('getNoteById result: %j', result);
    return note;
  } catch (e) {
    console.log('getNoteById error: ', e);
    return null;
  }
};

export const createNote = async (event: AppSyncEvent) => {
  try {
    console.log('createNote event: %j', event);
    const { note } = event.arguments;
    const params = {
      Item: note,
      TableName,
    };
    const result = await docClient.put(params).promise();
    console.log('createNote result: %j', result);
    return note;
  } catch (e) {
    console.log('createNote error: ', e);
    return null;
  }
};

export const updateNote = async (event: AppSyncEvent) => {
  try {
    console.log('updateNote event: %j', event);
    const { note } = event.arguments;
    let params: UpdateParams = {
      TableName,
      Key: {
        id: note.id,
      },
      ExpressionAttributeValues: {},
      ExpressionAttributeNames: {},
      UpdateExpression: '',
      ReturnValues: 'UPDATED_NEW',
    };
    let prefix = 'set ';
    const attributes = Object.keys(note);
    for (let i = 0; i < attributes.length; i++) {
      let attribute = attributes[i];
      if (attribute !== 'id') {
        params['UpdateExpression'] += `${prefix}#${attribute} = :${attribute}`;
        params['ExpressionAttributeValues'][`:${attribute}`] = (note as Record<string, any>)[attribute];
        params['ExpressionAttributeNames'][`#${attribute}`] = attribute;
        prefix = ', ';
      }
    }
    console.log('updateNote params: %j', params);
    const result = await docClient.update(<UpdateItemInput>params).promise();
    console.log('updateNote result: %j', result);
    return note;
  } catch (e) {
    console.log('updateNote error: ', e);
    return null;
  }
};

export const deleteNote = async (event: AppSyncEvent) => {
  try {
    console.log('deleteNote event: %j', event);
    const { noteId: id } = event.arguments;
    const params = {
      TableName,
      Key: {
        id,
      },
    };
    const result = await docClient.delete(params).promise();
    console.log('deleteNote result: %j', result);
    return id;
  } catch (e) {
    console.log('deleteNote error: ', e);
    return null;
  }
};

const resolvers: Record<string, ResolverMapping> = {
  getNoteById: { typeName: 'Query', handler: getNoteById },
  createNote: { typeName: 'Mutation', handler: createNote },
  listNotes: { typeName: 'Query', handler: listNotes },
  deleteNote: { typeName: 'Mutation', handler: deleteNote },
  updateNote: { typeName: 'Mutation', handler: updateNote },
};

export default resolvers;
