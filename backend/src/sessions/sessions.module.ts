import { Module } from '@nestjs/common';

import { AttendeesModule } from '../attendees/attendees.module';
import { DatabaseModule } from '../database/database.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [DatabaseModule, AttendeesModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
