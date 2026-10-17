import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceGuard } from '../src/common/guards/workspace.guard';

function createContext(request: Record<string, any>): any {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  };
}

describe('WorkspaceGuard tenant isolation', () => {
  it('allows a workspace member and attaches the verified workspace context', async () => {
    const workspace = {
      id: 'workspace-a',
      ownerId: 'owner-a',
      members: [{ id: 'membership-a', userId: 'member-a', role: 'MEMBER' }],
    };
    const prisma = { workspace: { findUnique: vi.fn().mockResolvedValue(workspace) } };
    const request = { user: { id: 'member-a' }, query: { workspaceId: 'workspace-a' }, headers: {}, params: {} };
    const guard = new WorkspaceGuard(prisma as any);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: 'workspace-a' },
      include: { members: { where: { userId: 'member-a' } } },
    });
    expect(request.workspaceContext.workspace).toBe(workspace);
  });

  it('rejects a user who is not a member of the requested workspace', async () => {
    const prisma = {
      workspace: { findUnique: vi.fn().mockResolvedValue({ id: 'workspace-b', ownerId: 'owner-b', members: [] }) },
    };
    const request = { user: { id: 'member-a' }, query: { workspaceId: 'workspace-b' }, headers: {}, params: {} };
    const guard = new WorkspaceGuard(prisma as any);

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an unknown workspace instead of treating it as unscoped', async () => {
    const prisma = { workspace: { findUnique: vi.fn().mockResolvedValue(null) } };
    const request = { user: { id: 'member-a' }, query: { workspaceId: 'missing' }, headers: {}, params: {} };
    const guard = new WorkspaceGuard(prisma as any);

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(NotFoundException);
  });
});
