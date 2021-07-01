import { AppSyncEvent } from './handler';

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
