export const resolvers = [
  { typeName: 'Query', fieldName: 'listNotes' },
  { typeName: 'Query', fieldName: 'getNoteById' },
  { typeName: 'Mutation', fieldName: 'createNote' },
  { typeName: 'Mutation', fieldName: 'updateNote' },
  { typeName: 'Mutation', fieldName: 'deleteNote' },
];

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
  console.log(event);
  return null;
};
