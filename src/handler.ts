import { BaseResolverProps } from '@aws-cdk/aws-appsync';
import resolvers from './notes-api';

export type AppSyncEvent = {
  info: {
    fieldName: string;
  };
  arguments: {
    note: Record<'id' | 'title' | 'content', string>;
    noteId: string;
  };
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

export const handler = async (event: AppSyncEvent) => {
  return resolvers.hasOwnProperty(event.info.fieldName)
    ? resolvers[event.info.fieldName].handler(event)
    : null;
};
