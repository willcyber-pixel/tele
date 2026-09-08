import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * One row per (attendee, session) pick.
 *
 * This single table answers both product questions -- "what is on my
 * schedule?" and "who else is going to this session?" -- as two different
 * queries over the same join. The unique constraint makes adding a session
 * idempotent at the database level rather than relying on a read-then-write.
 */
@Entity('schedule_entries')
@Unique('uq_attendee_session', ['attendeeId', 'sessionId'])
export class ScheduleEntryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  attendeeId: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  sessionId: string;

  @Column({ type: 'varchar', length: 40 })
  createdAt: string;
}
