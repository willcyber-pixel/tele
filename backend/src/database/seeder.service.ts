import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AttendeeEntity } from '../attendees/entities/attendee.entity';
import { ScheduleEntryEntity } from '../schedule/entities/schedule-entry.entity';
import { SessionEntity } from '../sessions/entities/session.entity';
import { AGENDA_SEED } from './agenda.seed-data';
import {
  ATTENDEES_SEED,
  CURRENT_ATTENDEE_ID,
  seededAttendeesForSession,
} from './attendees.seed-data';

/**
 * Idempotent seeding on boot. Safe to run against an existing database:
 * agenda and attendee rows are upserted, and fabricated attendance is only
 * generated for sessions that have none yet, so a user's real picks are never
 * clobbered by a restart.
 */
@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(AttendeeEntity)
    private readonly attendees: Repository<AttendeeEntity>,
    @InjectRepository(ScheduleEntryEntity)
    private readonly entries: Repository<ScheduleEntryEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    await this.sessions.save(
      AGENDA_SEED.map((s) => ({ ...s, fullWidth: s.fullWidth ?? false })),
    );
    await this.attendees.save(ATTENDEES_SEED);

    const existing = await this.entries.count();
    if (existing === 0) {
      await this.seedAttendance();
    }

    this.logger.log(
      `Seeded ${AGENDA_SEED.length} sessions and ${ATTENDEES_SEED.length} attendees`,
    );
  }

  private async seedAttendance(): Promise<void> {
    const now = new Date().toISOString();

    const rows = AGENDA_SEED.filter((s) => s.kind !== 'break').flatMap((session) =>
      seededAttendeesForSession(session.id).map((attendeeId) => ({
        attendeeId,
        sessionId: session.id,
        createdAt: now,
      })),
    );

    await this.entries.save(rows);
  }

  /** Test helper: wipe everything, then re-seed from scratch. */
  async reset(): Promise<void> {
    await this.entries.clear();
    await this.sessions.clear();
    await this.attendees.clear();
    await this.seed();
  }

  /** Test helper: remove only the current user's picks. */
  async clearScheduleFor(attendeeId = CURRENT_ATTENDEE_ID): Promise<void> {
    await this.entries.delete({ attendeeId });
  }
}
