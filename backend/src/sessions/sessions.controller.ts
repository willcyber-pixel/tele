import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';

import { AttendeesService } from '../attendees/attendees.service';
import { SessionEntity } from './entities/session.entity';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly attendees: AttendeesService,
  ) {}

  @Get()
  findAll(@Query('day') day?: string): Promise<SessionEntity[]> {
    return this.sessions.findAll(day ? Number(day) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SessionEntity> {
    return this.sessions.findOne(id);
  }

  @Get(':id/attendees')
  async findAttendees(@Param('id') id: string) {
    await this.sessions.findOne(id); // 404 for an unknown session
    return this.attendees.findForSession(id);
  }
}
