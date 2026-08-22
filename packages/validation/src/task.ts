import { z } from 'zod';

export const taskStatusSchema = z.enum([
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
]);

export const taskPrioritySchema = z.enum([
  'URGENT',
  'HIGH',
  'MEDIUM',
  'LOW',
  'NONE',
]);

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(255),
  description: z.string().max(4000).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  status: taskStatusSchema.default('TODO'),
  priority: taskPrioritySchema.default('MEDIUM'),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  labelIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  completedAt: z.string().datetime().optional().nullable(),
  archivedAt: z.string().datetime().optional().nullable(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty').max(2000),
});

export const createReminderSchema = z.object({
  remindAt: z.string().datetime(),
  type: z.enum(['DUE_DATE', 'CUSTOM', 'RECURRING']).default('CUSTOM'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
