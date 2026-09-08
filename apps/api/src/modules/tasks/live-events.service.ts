import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface LiveEventPayload {
  workspaceId: string;
  type:
    | 'TASK_CREATED'
    | 'TASK_UPDATED'
    | 'TASK_COMPLETED'
    | 'TASK_DELETED'
    | 'TASK_ASSIGNED'
    | 'MEMBER_INVITED'
    | 'INVITATION_ACCEPTED'
    | 'INVITATION_RECEIVED'
    | 'MEMBER_LEFT'
    | 'WORKSPACE_SYNC';
  timestamp: string;
  data?: any;
}

@Injectable()
export class LiveEventsService {
  private events$ = new Subject<LiveEventPayload>();

  emit(event: Omit<LiveEventPayload, 'timestamp'>) {
    this.events$.next({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  getStream(workspaceId?: string): Observable<{ data: LiveEventPayload }> {
    return this.events$.asObservable().pipe(
      filter((e) => !workspaceId || e.workspaceId === workspaceId),
      map((event) => ({ data: event }))
    );
  }
}
