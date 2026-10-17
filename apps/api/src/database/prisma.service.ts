import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@flowtask/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log(' Connected to PostgreSQL database');

      // Auto self-heal schema columns for PostgreSQL if missing
      if (typeof (this as any).$executeRawUnsafe === 'function') {
        try {
          await (this as any).$executeRawUnsafe(`
            ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "taskMetadata" JSONB DEFAULT '{}';
            ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
            ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN DEFAULT false;
            ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "recurrenceRule" TEXT;
            ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "parentTaskId" TEXT;
            ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
            ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
          `);
          this.logger.log(' Schema self-healing verified for tasks table');
        } catch (schemaErr) {
          this.logger.warn('Schema self-healing notice: ' + (schemaErr as any)?.message);
        }
      }
    } catch (error) {
      this.logger.error(' Failed to connect to PostgreSQL database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log(' Disconnected from PostgreSQL database');
  }
}
