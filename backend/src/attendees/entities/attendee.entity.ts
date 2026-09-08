import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('attendees')
export class AttendeeEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  company: string | null;
}
