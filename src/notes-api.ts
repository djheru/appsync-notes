import { AppSyncEvent } from './handler';

export interface ResolverMapping {
  typeName: string;
  handler: (event: AppSyncEvent) => any;
}

export const listNotes = (event: AppSyncEvent) => {
  console.log({ listNotes: event });
  return null;
};
export const getNoteById = (event: AppSyncEvent) => {
  console.log({ getNoteById: event });
  return null;
};
export const createNote = (event: AppSyncEvent) => {
  console.log({ createNote: event });
  return null;
};
export const updateNote = (event: AppSyncEvent) => {
  console.log({ updateNote: event });
  return null;
};
export const deleteNote = (event: AppSyncEvent) => {
  console.log({ deleteNote: event });
  return null;
};

const resolvers: Record<string, ResolverMapping> = {
  listNotes: { typeName: 'Query', handler: listNotes },
  getNoteById: { typeName: 'Query', handler: getNoteById },
  createNote: { typeName: 'Mutation', handler: createNote },
  updateNote: { typeName: 'Mutation', handler: updateNote },
  deleteNote: { typeName: 'Mutation', handler: deleteNote },
};

export default resolvers;
