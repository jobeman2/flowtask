import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { LiveEventsService } from './live-events.service';

@Module({
  imports: [TelegramModule],
  providers: [TasksService, LiveEventsService],
  controllers: [TasksController],
  exports: [TasksService, LiveEventsService],
})
export class TasksModule {}

