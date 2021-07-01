import { BaseResolverProps } from '@aws-cdk/aws-appsync';
import { listNotes, getNoteById, createNote, updateNote, deleteNote } from './notes-api';

export interface ResolverMapping {
  typeName: string;
  handler: (event: AppSyncEvent) => any;
}

const resolvers: Record<string, ResolverMapping> = {
  listNotes: { typeName: 'Query', handler: listNotes },
  getNoteById: { typeName: 'Query', handler: getNoteById },
  createNote: { typeName: 'Mutation', handler: createNote },
  updateNote: { typeName: 'Mutation', handler: updateNote },
  deleteNote: { typeName: 'Mutation', handler: deleteNote },
};

export const resolverConfig = <BaseResolverProps[]>(
  Object.keys(resolvers).reduce(
    (acc: Record<string, any>[], fieldName: string) => [
      ...acc,
      { fieldName, typeName: resolvers[fieldName].typeName },
    ],
    []
  )
);

export type AppSyncEvent = {
  info: {
    fieldName: string;
  };
  arguments: {
    note: Record<string, any>;
    noteId: string;
  };
};

export const handler = async (event: AppSyncEvent) => {
  return resolvers.hasOwnProperty(event.info.fieldName)
    ? resolvers[event.info.fieldName].handler(event)
    : null;
};
