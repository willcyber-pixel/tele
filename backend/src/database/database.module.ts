import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { AttendeeEntity } from '../attendees/entities/attendee.entity';
import { ScheduleEntryEntity } from '../schedule/entities/schedule-entry.entity';
import { SessionEntity } from '../sessions/entities/session.entity';
import { SeederService } from './seeder.service';

export const ENTITIES = [SessionEntity, AttendeeEntity, ScheduleEntryEntity];

/**
 * Build the TypeORM connection for the configured driver.
 *
 * The POC runs on SQLite. Switching to MSSQL is intended to be a config change
 * only -- set DB_DRIVER=mssql plus the connection variables. Entity column
 * types are already portable, so no schema rewrite is involved.
 *
 * `synchronize` is enabled for SQLite only. On MSSQL it stays off and real
 * migrations take over, which is what you want the moment the data outlives
 * the process.
 */
export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const driver = config.get<string>('DB_DRIVER', 'sqlite');

  if (driver === 'mssql') {
    return {
      type: 'mssql',
      host: config.get<string>('DB_HOST', 'localhost'),
      port: Number(config.get<string>('DB_PORT', '1433')),
      username: config.get<string>('DB_USERNAME'),
      password: config.get<string>('DB_PASSWORD'),
      database: config.get<string>('DB_NAME', 'startfest'),
      entities: ENTITIES,
      synchronize: false,
      options: {
        encrypt: config.get<string>('DB_ENCRYPT', 'true') === 'true',
        trustServerCertificate:
          config.get<string>('DB_TRUST_CERT', 'true') === 'true',
      },
    };
  }

  return {
    type: 'sqlite',
    database: config.get<string>('DB_DATABASE', 'startfest.sqlite'),
    entities: ENTITIES,
    synchronize: true,
    logging: config.get<string>('DB_LOGGING', 'false') === 'true',
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  providers: [SeederService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
