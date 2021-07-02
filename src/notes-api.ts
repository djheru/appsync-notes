import { AppSyncEvent } from './handler';
import { getRepository } from 'typeorm';
import { getConnection } from './db';
import { Note } from './entities/note.entity';

export interface ResolverMapping {
  typeName: string;
  handler: (event: AppSyncEvent) => any;
}

export const listNotes = async (event: AppSyncEvent) => {
  try {
    console.log('listNotes event: %j', event);
    await getConnection();
    const repository = getRepository(Note);
    const notes = await repository.find();
    console.log('listNotes result: %j', notes);
    return notes;
  } catch (e) {
    console.log('listNotes error: ', e);
    return null;
  }
};

export const getNoteById = async (event: AppSyncEvent) => {
  try {
    console.log('getNoteById event: %j', event);
    await getConnection();
    const repository = getRepository(Note);
    const note = await repository.findOne(event.arguments.noteId);
    console.log('getNoteById result: %j', note);
    return note;
  } catch (e) {
    console.log('getNoteById error: ', e);
    return null;
  }
};

export const createNote = async (event: AppSyncEvent) => {
  try {
    console.log('createNote event: %j', event);
    await getConnection();
    const repository = getRepository(Note);
    const note = repository.create(<Note>event.arguments.note);
    await repository.save(note);
    console.log('createNote result: %j', note);
    return note;
  } catch (e) {
    console.log('createNote error: ', e);
    return null;
  }
};

export const updateNote = async (event: AppSyncEvent) => {
  try {
    console.log('updateNote event: %j', event);
    const { id, title, content } = event.arguments.note;
    await getConnection();
    const repository = getRepository(Note);
    const result = repository.update(id, { title, content });
    console.log('updateNote result: %j', result);
    return result;
  } catch (e) {
    console.log('updateNote error: ', e);
    return null;
  }
};

export const deleteNote = async (event: AppSyncEvent) => {
  try {
    console.log('deleteNote event: %j', event);
    await getConnection();
    const repository = getRepository(Note);
    const result = repository.delete(event.arguments.noteId);
    console.log('deleteNote result: %j', result);
    return result;
  } catch (e) {
    console.log('deleteNote error: ', e);
    return null;
  }
};

const resolvers: Record<string, ResolverMapping> = {
  listNotes: { typeName: 'Query', handler: listNotes },
  getNoteById: { typeName: 'Query', handler: getNoteById },
  createNote: { typeName: 'Mutation', handler: createNote },
  updateNote: { typeName: 'Mutation', handler: updateNote },
  deleteNote: { typeName: 'Mutation', handler: deleteNote },
};

export default resolvers;
