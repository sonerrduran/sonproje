import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';

interface TrackEventJob {
  schoolId: string;
  userId: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

@Processor('analytics')
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<TrackEventJob>) {
    if (job.name === 'track-event') {
      const { schoolId, userId, eventType, entityType, entityId, data } = job.data;
      try {
        await this.prisma.learningEvent.create({
          data: { schoolId, userId, eventType, entityType, entityId, data: data ?? {} },
        });
        this.logger.debug(`Event tracked: ${eventType} [user: ${userId}]`);
      } catch (err) {
        this.logger.error(`Failed to track event: ${eventType}`, err);
        throw err; // Will retry via BullMQ backoff
      }
    }
  }
}
