process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/flowtask';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-1234567890';
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123456:TEST_TOKEN';

import 'reflect-metadata';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { TasksController } from '../src/modules/tasks/tasks.controller';
import { WorkspaceGuard } from '../src/common/guards/workspace.guard';
import { LiveEventsService } from '../src/modules/tasks/live-events.service';
import { firstValueFrom, take } from 'rxjs';

describe('Tasks live stream authorization', () => {
  it('keeps the route behind the global JWT guard and workspace membership guard', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) as Array<any>;
    const jwtGuardProvider = providers.find((provider) => provider.provide === APP_GUARD && provider.useClass === JwtAuthGuard);
    const controllerGuards = Reflect.getMetadata(GUARDS_METADATA, TasksController) as any[];

    expect(jwtGuardProvider).toBeDefined();
    expect(controllerGuards).toContain(WorkspaceGuard);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TasksController.prototype.liveStream)).not.toBe(true);
  });

  it('rejects requests when the JWT guard has no authenticated user', () => {
    const guard = new JwtAuthGuard({ getAllAndOverride: () => undefined } as any);

    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });

  it('requires a workspace filter and streams only the requested workspace', () => {
    const stream = {} as any;
    const liveEventsService = { getStream: vi.fn().mockReturnValue(stream) };
    const controller = new TasksController({} as any, liveEventsService as any);

    expect(() => controller.liveStream()).toThrow(BadRequestException);
    expect(controller.liveStream('workspace-a')).toBe(stream);
    expect(liveEventsService.getStream).toHaveBeenCalledExactlyOnceWith('workspace-a');
  });

  it('does not emit events from another workspace', async () => {
    const service = new LiveEventsService();
    const nextEvent = firstValueFrom(service.getStream('workspace-a').pipe(take(1)));

    service.emit({ workspaceId: 'workspace-b', type: 'TASK_UPDATED', data: { title: 'private to B' } });
    service.emit({ workspaceId: 'workspace-a', type: 'TASK_UPDATED', data: { title: 'visible to A' } });

    await expect(nextEvent).resolves.toMatchObject({
      data: { workspaceId: 'workspace-a', type: 'TASK_UPDATED', data: { title: 'visible to A' } },
    });
  });
});
