import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Conflict, detectConflicts } from '../domain/conflicts';
import { buildCalendar, CalendarEvent } from '../domain/ics';
import { SessionEntity } from '../sessions/entities/session.entity';
import { SessionsService } from '../sessions/sessions.service';
import { ScheduleEntryEntity } from './entities/schedule-entry.entity';

export const VENUE = 'Mountain America Event Venue - Loveland Living Planet Aquarium';

const ROOM_LABELS: Record<string, string> = {
  mainstage: 'Mainstage',
  start: 'Start Room',
  ignition: 'Ignition Room',
  accelerator: 'Accelerator',
};

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ScheduleEntryEntity)
    private readonly entries: Repository<ScheduleEntryEntity>,
    private readonly sessions: SessionsService,
  ) {}

  async listSessionIds(attendeeId: string): Promise<string[]> {
    const rows = await this.entries.find({ where: { attendeeId } });
    return rows.map((r) => r.sessionId);
  }

  async list(attendeeId: string): Promise<SessionEntity[]> {
    return this.sessions.findByIds(await this.listSessionIds(attendeeId));
  }

  /**
   * Add a session to a schedule.
   *
   * Validates the session exists (404 via SessionsService), then relies on the
   * unique constraint to make repeat adds a no-op rather than reading first --
   * which would be racy under concurrent requests.
   */
  async add(attendeeId: string, sessionId: string): Promise<SessionEntity[]> {
    await this.sessions.findOne(sessionId);

    await this.entries
      .createQueryBuilder()
      .insert()
      .into(ScheduleEntryEntity)
      .values({ attendeeId, sessionId, createdAt: new Date().toISOString() })
      .orIgnore()
      .execute();

    return this.list(attendeeId);
  }

  async remove(attendeeId: string, sessionId: string): Promise<SessionEntity[]> {
    await this.entries.delete({ attendeeId, sessionId });
    return this.list(attendeeId);
  }

  /**
   * Conflicts across a schedule, computed on UTC instants.
   * Breaks are excluded -- a session running through lunch is not a clash.
   */
  async conflicts(attendeeId: string): Promise<Conflict[]> {
    const sessions = await this.list(attendeeId);
    return detectConflicts(
      sessions
        .filter((s) => s.kind !== 'break')
        .map((s) => ({
          id: s.id,
          startUtc: s.startUtc,
          endUtc: s.endUtc,
          room: s.room,
        })),
    );
  }

  /** Render a schedule as an RFC 5545 calendar document. */
  async toCalendar(attendeeId: string, now?: Date): Promise<string> {
    const sessions = await this.list(attendeeId);
    return buildCalendar(sessions.map(toCalendarEvent), {
      calendarName: 'My StartFEST Schedule',
      reminderMinutes: 10,
      now,
    });
  }
}

export function toCalendarEvent(session: SessionEntity): CalendarEvent {
  const room = ROOM_LABELS[session.room] ?? session.room;

  const descriptionParts: string[] = [];
  if (session.speakers?.length) {
    descriptionParts.push(
      session.speakers
        .map((s) => (s.title ? `${s.name} - ${s.title}` : s.name))
        .join('\n'),
    );
  }
  if (session.description) descriptionParts.push(session.description);

  return {
    uid: `${session.id}@startfest2026`,
    title: session.title,
    startUtc: session.startUtc,
    endUtc: session.endUtc,
    location: `${room}, ${VENUE}`,
    description: descriptionParts.join('\n\n') || undefined,
  };
}
