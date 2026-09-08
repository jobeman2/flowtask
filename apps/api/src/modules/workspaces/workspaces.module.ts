import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TelegramModule, TasksModule],
  providers: [WorkspacesService],
  controllers: [WorkspacesController],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
