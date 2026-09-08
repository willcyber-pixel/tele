import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ScheduleEntryEntity } from '../schedule/entities/schedule-entry.entity';
import { AttendeeEntity } from './entities/attendee.entity';

@Injectable()
export class AttendeesService {
  constructor(
    @InjectRepository(AttendeeEntity)
    private readonly attendees: Repository<AttendeeEntity>,
    @InjectRepository(ScheduleEntryEntity)
    private readonly entries: Repository<ScheduleEntryEntity>,
  ) {}

  findAll(): Promise<AttendeeEntity[]> {
    return this.attendees.find({ order: { name: 'ASC' } });
  }

  /** Everyone who has this session on their schedule. */
  async findForSession(sessionId: string): Promise<AttendeeEntity[]> {
    const rows = await this.entries.find({ where: { sessionId } });
    return this.hydrate(rows.map((r) => r.attendeeId));
  }

  /**
   * Attendees for many sessions in one round trip.
   *
   * The per-card avatar stack would otherwise fire one query per session --
   * ~36 requests to paint a single day. This batches to two queries total and
   * returns a map the caller can index directly.
   */
  async findForSessions(
    sessionIds: string[],
  ): Promise<Record<string, AttendeeEntity[]>> {
    const result: Record<string, AttendeeEntity[]> = {};
    for (const id of sessionIds) result[id] = [];
    if (sessionIds.length === 0) return result;

    const rows = await this.entries.find({
      where: { sessionId: In(sessionIds) },
    });

    const people = await this.hydrate(rows.map((r) => r.attendeeId));
    const byId = new Map(people.map((p) => [p.id, p]));

    for (const row of rows) {
      const person = byId.get(row.attendeeId);
      if (person && result[row.sessionId]) {
        result[row.sessionId].push(person);
      }
    }
    return result;
  }

  private async hydrate(ids: string[]): Promise<AttendeeEntity[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const people = await this.attendees.find({ where: { id: In(unique) } });
    return people.sort((a, b) => a.name.localeCompare(b.name));
  }
}
