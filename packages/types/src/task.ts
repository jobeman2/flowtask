export type TaskStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  | 'CANCELLED';

export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  creatorId: string;
  assigneeId: string | null;
  dueDate: Date | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  parentTaskId: string | null;
  completedAt: Date | null;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface Label {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
}

export interface TaskLabel {
  taskId: string;
  labelId: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReminderStatus = 'PENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
export type ReminderType = 'DUE_DATE' | 'CUSTOM' | 'RECURRING';

export interface Reminder {
  id: string;
  taskId: string;
  remindAt: Date;
  snoozedUntil: Date | null;
  snoozeCount: number;
  type: ReminderType;
  status: ReminderStatus;
  createdAt: Date;
}
