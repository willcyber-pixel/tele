import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { SessionEntity } from './entities/session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
  ) {}

  findAll(day?: number): Promise<SessionEntity[]> {
    return this.sessions.find({
      where: day ? { day } : {},
      order: { startUtc: 'ASC', room: 'ASC' },
    });
  }

  async findOne(id: string): Promise<SessionEntity> {
    const session = await this.sessions.findOne({ where: { id } });
    if (!session) {
      throw new NotFoundException(`Session not found: ${id}`);
    }
    return session;
  }

  findByIds(ids: string[]): Promise<SessionEntity[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.sessions.find({
      where: { id: In(ids) },
      order: { startUtc: 'ASC' },
    });
  }
}
