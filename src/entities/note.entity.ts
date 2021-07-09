import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  @Index({ fulltext: true })
  content: string;

  @Column({ type: 'boolean' })
  completed: boolean;
}

export type NoteType = {
  id: string;
  title: string;
  content: string;
  completed: boolean;
};
