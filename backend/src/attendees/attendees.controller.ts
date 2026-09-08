import { Controller, Get, Query } from '@nestjs/common';

import { AttendeesService } from './attendees.service';
import { AttendeeEntity } from './entities/attendee.entity';

@Controller('attendees')
export class AttendeesController {
  constructor(private readonly attendees: AttendeesService) {}

  @Get()
  findAll(): Promise<AttendeeEntity[]> {
    return this.attendees.findAll();
  }

  /** Batched lookup: /attendees/by-session?ids=a,b,c */
  @Get('by-session')
  findForSessions(@Query('ids') ids?: string) {
    const sessionIds = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.attendees.findForSessions(sessionIds);
  }
}
