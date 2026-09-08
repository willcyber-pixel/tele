import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';

import { AttendeesModule } from './attendees/attendees.module';
import { DatabaseModule } from './database/database.module';
import { ScheduleModule } from './schedule/schedule.module';
import { SessionsModule } from './sessions/sessions.module';

/**
 * Where the built frontend lands, relative to the compiled backend
 * (backend/dist/main.js -> ../../frontend/dist).
 */
export const CLIENT_DIST = join(__dirname, '..', '..', 'frontend', 'dist');

/**
 * Serve the React build from the API process.
 *
 * One service instead of two: same origin, so no CORS and no base-URL config,
 * and it fits a single Render web service. Registered only when the build
 * actually exists, so running the API alone in development (where Vite serves
 * the frontend and proxies /api here) does not warn about a missing folder.
 */
function clientModules(): DynamicModule[] {
  if (!existsSync(CLIENT_DIST)) return [];

  return [
    ServeStaticModule.forRoot({
      rootPath: CLIENT_DIST,
      // Anything under /api is the API's, not the SPA's.
      exclude: ['/api/(.*)'],
    }),
  ];
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SessionsModule,
    AttendeesModule,
    ScheduleModule,
    ...clientModules(),
  ],
})
export class AppModule {}
