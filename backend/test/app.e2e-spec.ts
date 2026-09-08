import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';

import { AttendeesModule } from '../src/attendees/attendees.module';
import { AttendeeEntity } from '../src/attendees/entities/attendee.entity';
import { ENTITIES } from '../src/database/database.module';
import { SeederService } from '../src/database/seeder.service';
import { ScheduleModule } from '../src/schedule/schedule.module';
import { SessionsModule } from '../src/sessions/sessions.module';

const ME = 'me';

/**
 * Reverse RFC 5545 line folding so assertions can match on the logical value.
 * A long LOCATION or DESCRIPTION is split across 75-octet lines in valid
 * output, so searching the raw text for a long substring would fail.
 */
const unfold = (ics: string) => ics.replace(/\r\n /g, '');

/**
 * End-to-end coverage of the five product requirements, run against a real
 * SQLite database (in-memory, so each run starts clean and nothing leaks
 * between suites). The same suite is intended to run unchanged against MSSQL
 * once DB_DRIVER is switched -- nothing below is SQLite-specific.
 */
describe('StartFEST scheduler (e2e)', () => {
  let app: INestApplication;
  let seeder: SeederService;
  let http: () => ReturnType<typeof request>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: ENTITIES,
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature(ENTITIES),
        SessionsModule,
        AttendeesModule,
        ScheduleModule,
      ],
      providers: [SeederService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    seeder = moduleRef.get(SeederService);
    http = () => request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await seeder.clearScheduleFor(ME);
  });

  // ------------------------------------------------------------------------
  // Requirement 1: browse the full agenda across both days
  // ------------------------------------------------------------------------
  describe('Requirement 1 - browse the full agenda', () => {
    it('returns the complete agenda', async () => {
      const res = await http().get('/api/sessions').expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(34);
      expect(res.body.some((s: any) => s.day === 1)).toBe(true);
      expect(res.body.some((s: any) => s.day === 2)).toBe(true);
    });

    it('filters by day', async () => {
      const day1 = await http().get('/api/sessions?day=1').expect(200);
      const day2 = await http().get('/api/sessions?day=2').expect(200);

      expect(day1.body.every((s: any) => s.day === 1)).toBe(true);
      expect(day2.body.every((s: any) => s.day === 2)).toBe(true);
      expect(day1.body.length).toBeGreaterThan(0);
      expect(day2.body.length).toBeGreaterThan(0);
    });

    it('returns sessions ordered by start instant', async () => {
      const res = await http().get('/api/sessions?day=1').expect(200);
      const starts = res.body.map((s: any) => Date.parse(s.startUtc));

      expect(starts).toEqual([...starts].sort((a, b) => a - b));
    });

    it('exposes every field the grid needs to lay a card out', async () => {
      const res = await http().get('/api/sessions/d1-bridging-the-gap').expect(200);

      expect(res.body).toMatchObject({
        id: 'd1-bridging-the-gap',
        title: 'Bridging the Gap',
        day: 1,
        room: 'start',
        track: 'funding',
        kind: 'session',
        startUtc: '2026-06-23T16:30:00.000Z',
        endUtc: '2026-06-23T17:05:00.000Z',
      });
      expect(res.body.speakers[0].name).toBe('Scott Holley');
    });

    it('stores every time as a UTC instant', async () => {
      const res = await http().get('/api/sessions').expect(200);

      res.body.forEach((s: any) => {
        expect(s.startUtc).toMatch(/Z$/);
        expect(s.endUtc).toMatch(/Z$/);
        expect(Date.parse(s.endUtc)).toBeGreaterThan(Date.parse(s.startUtc));
      });
    });

    it('covers all three breakout rooms plus the mainstage', async () => {
      const res = await http().get('/api/sessions').expect(200);
      const rooms = new Set(res.body.map((s: any) => s.room));

      expect(rooms).toEqual(
        new Set(['mainstage', 'start', 'ignition', 'accelerator']),
      );
    });

    it('404s for an unknown session', async () => {
      await http().get('/api/sessions/does-not-exist').expect(404);
    });
  });

  // ------------------------------------------------------------------------
  // Requirement 2: build a personal schedule
  // ------------------------------------------------------------------------
  describe('Requirement 2 - build a personal schedule', () => {
    it('starts empty', async () => {
      const res = await http().get(`/api/schedule/${ME}`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('adds a session and returns the updated schedule', async () => {
      const res = await http()
        .post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`)
        .expect(201);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('d1-bridging-the-gap');
    });

    it('persists the pick across requests', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);

      const res = await http().get(`/api/schedule/${ME}`).expect(200);
      expect(res.body.map((s: any) => s.id)).toEqual(['d1-bridging-the-gap']);
    });

    it('is idempotent - adding twice does not duplicate', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-funding`).expect(201);
      const res = await http()
        .post(`/api/schedule/${ME}/sessions/d1-funding`)
        .expect(201);

      expect(res.body).toHaveLength(1);
    });

    it('removes a session', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-funding`).expect(201);
      const res = await http()
        .delete(`/api/schedule/${ME}/sessions/d1-funding`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('tolerates removing something that was never added', async () => {
      await http().delete(`/api/schedule/${ME}/sessions/d1-funding`).expect(200);
    });

    it('rejects adding a session that does not exist', async () => {
      await http().post(`/api/schedule/${ME}/sessions/nope`).expect(404);
    });

    it('returns the schedule in chronological order', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d2-sustainable-ai`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d1-leadership-daly`).expect(201);

      const res = await http().get(`/api/schedule/${ME}`).expect(200);
      expect(res.body.map((s: any) => s.id)).toEqual([
        'd1-bridging-the-gap',
        'd1-leadership-daly',
        'd2-sustainable-ai',
      ]);
    });

    it('keeps schedules isolated between attendees', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-funding`).expect(201);

      const other = await http().get('/api/schedule/a-avery').expect(200);
      expect(other.body.map((s: any) => s.id)).not.toContain('d1-funding');
    });
  });

  // ------------------------------------------------------------------------
  // Requirement 3: catch time conflicts (UTC diff)
  // ------------------------------------------------------------------------
  describe('Requirement 3 - catch time conflicts', () => {
    it('reports no conflicts for an empty schedule', async () => {
      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('reports no conflict for sequential sessions', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d1-leadership-daly`).expect(201);

      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('detects an overlap between two sessions in the same slot', async () => {
      // Both run 16:30-17:05Z, in different rooms.
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d1-ai-blueprint-workshop`).expect(201);

      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        severity: 'overlap',
        overlapMinutes: 35,
      });
      expect([res.body[0].aId, res.body[0].bId].sort()).toEqual(
        ['d1-ai-blueprint-workshop', 'd1-bridging-the-gap'].sort(),
      );
    });

    it('detects an overlap between two sessions stacked in the same room', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      await http()
        .post(`/api/schedule/${ME}/sessions/d1-surviving-ai-correction`)
        .expect(201);

      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].severity).toBe('overlap');
    });

    it('flags a tight transition between rooms', async () => {
      // Day 2: 17:00-17:35Z in start, then 17:40-18:15Z in ignition => 5 min.
      await http().post(`/api/schedule/${ME}/sessions/d2-chaos-to-process`).expect(201);
      await http()
        .post(`/api/schedule/${ME}/sessions/d2-unexpected-obvious-growth`)
        .expect(201);

      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ severity: 'tight', gapMinutes: 5 });
    });

    it('does not flag a tight transition within the same room', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d2-chaos-to-process`).expect(201);
      await http()
        .post(`/api/schedule/${ME}/sessions/d2-room-owes-you-nothing`)
        .expect(201);

      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('reports all three pairs when three sessions collide', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-ai-not-your-cmo`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d1-funding`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d1-even-achieving`).expect(201);

      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);
      expect(res.body).toHaveLength(3);
      expect(res.body.every((c: any) => c.severity === 'overlap')).toBe(true);
    });

    it('clears the conflict once one side is removed', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d1-ai-blueprint-workshop`).expect(201);
      await http()
        .delete(`/api/schedule/${ME}/sessions/d1-ai-blueprint-workshop`)
        .expect(200);

      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('does not treat a session spanning a break as a conflict', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-lunch`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d1-content-people-watch`).expect(201);

      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('never reports a conflict across different days', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d2-chaos-to-process`).expect(201);

      const res = await http().get(`/api/schedule/${ME}/conflicts`).expect(200);
      expect(res.body).toEqual([]);
    });
  });

  // ------------------------------------------------------------------------
  // Requirement 4: add sessions to a calendar (.ics)
  // ------------------------------------------------------------------------
  describe('Requirement 4 - calendar export', () => {
    it('serves a downloadable text/calendar document', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);

      const res = await http().get(`/api/schedule/${ME}/calendar.ics`).expect(200);

      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('.ics');
    });

    it('emits a valid VCALENDAR envelope', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      const res = await http().get(`/api/schedule/${ME}/calendar.ics`).expect(200);

      expect(res.text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
      expect(res.text.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
      expect(res.text).toContain('VERSION:2.0');
    });

    it('emits one VEVENT per picked session', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      await http().post(`/api/schedule/${ME}/sessions/d1-leadership-daly`).expect(201);

      const res = await http().get(`/api/schedule/${ME}/calendar.ics`).expect(200);
      expect(res.text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    });

    it('writes the correct UTC instants', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      const res = await http().get(`/api/schedule/${ME}/calendar.ics`).expect(200);

      expect(res.text).toContain('DTSTART:20260623T163000Z');
      expect(res.text).toContain('DTEND:20260623T170500Z');
    });

    it('includes the room and venue as the location', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      const res = await http().get(`/api/schedule/${ME}/calendar.ics`).expect(200);

      expect(unfold(res.text)).toContain('LOCATION:Start Room');
      expect(unfold(res.text)).toContain('Loveland Living Planet Aquarium');
    });

    it('includes speakers in the description', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      const res = await http().get(`/api/schedule/${ME}/calendar.ics`).expect(200);

      expect(unfold(res.text)).toContain('Scott Holley');
    });

    it('gives every event a stable unique id', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-bridging-the-gap`).expect(201);
      const res = await http().get(`/api/schedule/${ME}/calendar.ics`).expect(200);

      expect(res.text).toContain('UID:d1-bridging-the-gap@startfest2026');
    });

    it('keeps every content line within the 75-octet limit', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d2-unexpected-obvious-growth`).expect(201);
      const res = await http().get(`/api/schedule/${ME}/calendar.ics`).expect(200);

      res.text
        .split('\r\n')
        .filter(Boolean)
        .forEach((line) => {
          expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75);
        });
    });

    it('returns a valid empty calendar when nothing is picked', async () => {
      const res = await http().get(`/api/schedule/${ME}/calendar.ics`).expect(200);

      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).not.toContain('BEGIN:VEVENT');
    });
  });

  // ------------------------------------------------------------------------
  // Requirement 5: see who else is going
  // ------------------------------------------------------------------------
  describe('Requirement 5 - see who else is going', () => {
    it('lists attendees for a session', async () => {
      const res = await http()
        .get('/api/sessions/d1-bridging-the-gap/attendees')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('name');
    });

    it('returns a stable roster across repeated calls', async () => {
      const first = await http().get('/api/sessions/d1-funding/attendees').expect(200);
      const second = await http().get('/api/sessions/d1-funding/attendees').expect(200);

      expect(first.body.map((a: any) => a.id)).toEqual(
        second.body.map((a: any) => a.id),
      );
    });

    it('adds the current user to the roster once they pick the session', async () => {
      const before = await http()
        .get('/api/sessions/d1-funding/attendees')
        .expect(200);
      expect(before.body.map((a: any) => a.id)).not.toContain(ME);

      await http().post(`/api/schedule/${ME}/sessions/d1-funding`).expect(201);

      const after = await http().get('/api/sessions/d1-funding/attendees').expect(200);
      expect(after.body.map((a: any) => a.id)).toContain(ME);
    });

    it('drops the user from the roster when they remove the session', async () => {
      await http().post(`/api/schedule/${ME}/sessions/d1-funding`).expect(201);
      await http().delete(`/api/schedule/${ME}/sessions/d1-funding`).expect(200);

      const res = await http().get('/api/sessions/d1-funding/attendees').expect(200);
      expect(res.body.map((a: any) => a.id)).not.toContain(ME);
    });

    it('never lists the same attendee twice', async () => {
      const res = await http().get('/api/sessions/d1-funding/attendees').expect(200);
      const ids = res.body.map((a: any) => a.id);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it('batches rosters for many sessions in one request', async () => {
      const ids = ['d1-funding', 'd1-bridging-the-gap', 'd1-ai-blueprint-workshop'];
      const res = await http()
        .get(`/api/attendees/by-session?ids=${ids.join(',')}`)
        .expect(200);

      expect(Object.keys(res.body).sort()).toEqual([...ids].sort());
      ids.forEach((id) => expect(Array.isArray(res.body[id])).toBe(true));
    });

    it('returns an empty batch for no ids rather than erroring', async () => {
      const res = await http().get('/api/attendees/by-session?ids=').expect(200);
      expect(res.body).toEqual({});
    });

    it('404s for attendees of an unknown session', async () => {
      await http().get('/api/sessions/nope/attendees').expect(404);
    });
  });
});
