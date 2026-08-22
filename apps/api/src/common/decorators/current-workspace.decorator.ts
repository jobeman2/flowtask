import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Workspace, WorkspaceMember } from '@flowtask/types';

export interface WorkspaceContext {
  workspace: Workspace;
  membership: WorkspaceMember;
}

export const CurrentWorkspace = createParamDecorator(
  (data: keyof WorkspaceContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const context = request.workspaceContext as WorkspaceContext;

    return data && context ? context[data] : context;
  }
);
