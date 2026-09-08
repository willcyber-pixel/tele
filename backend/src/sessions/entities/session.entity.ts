import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type SessionKind = 'session' | 'keynote' | 'mainstage' | 'break' | 'special';

export type RoomId = 'mainstage' | 'start' | 'ignition' | 'accelerator';

export type TrackId =
  | 'ai'
  | 'marketing'
  | 'operations'
  | 'funding'
  | 'selfLeadership'
  | 'sales'
  | 'resource';

export interface Speaker {
  name: string;
  title?: string;
}

/**
 * Column types are kept deliberately portable (varchar / boolean / simple-json)
 * so the same entity maps cleanly onto SQLite today and MSSQL later without a
 * schema rewrite. Avoid driver-specific types such as `text` here: TypeORM maps
 * it to the deprecated `ntext` on MSSQL.
 *
 * Times are persisted as ISO-8601 UTC instants. The event runs in Mountain
 * Daylight Time (UTC-6) but nothing downstream is allowed to assume that --
 * conflict detection and .ics generation both operate on the UTC instant.
 */
@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Index()
  @Column({ type: 'int' })
  day: number;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  startUtc: string;

  @Column({ type: 'varchar', length: 40 })
  endUtc: string;

  @Column({ type: 'varchar', length: 32 })
  room: RoomId;

  @Column({ type: 'varchar', length: 32, nullable: true })
  track: TrackId | null;

  @Column({ type: 'varchar', length: 32 })
  kind: SessionKind;

  @Column({ type: 'boolean', default: false })
  fullWidth: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  speakers: Speaker[];
}
