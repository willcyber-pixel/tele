import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { ScheduleService } from './schedule.service';

@Controller('schedule/:attendeeId')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get()
  list(@Param('attendeeId') attendeeId: string) {
    return this.schedule.list(attendeeId);
  }

  @Post('sessions/:sessionId')
  add(
    @Param('attendeeId') attendeeId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.schedule.add(attendeeId, sessionId);
  }

  @Delete('sessions/:sessionId')
  remove(
    @Param('attendeeId') attendeeId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.schedule.remove(attendeeId, sessionId);
  }

  @Get('conflicts')
  conflicts(@Param('attendeeId') attendeeId: string) {
    return this.schedule.conflicts(attendeeId);
  }

  /**
   * Download the schedule as an .ics file.
   *
   * text/calendar plus a filename in Content-Disposition is what makes a
   * browser hand this to the OS calendar app rather than rendering it.
   */
  @Get('calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="startfest-schedule.ics"')
  async calendar(
    @Param('attendeeId') attendeeId: string,
    @Res() res: Response,
  ): Promise<void> {
    res.send(await this.schedule.toCalendar(attendeeId));
  }
}
