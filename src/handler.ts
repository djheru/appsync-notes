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
