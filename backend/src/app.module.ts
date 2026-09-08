import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AttendeesModule } from './attendees/attendees.module';
import { DatabaseModule } from './database/database.module';
import { ScheduleModule } from './schedule/schedule.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SessionsModule,
    AttendeesModule,
    ScheduleModule,
  ],
})
export class AppModule {}
