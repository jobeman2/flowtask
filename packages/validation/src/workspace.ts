import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters').max(50),
  type: z.enum(['PERSONAL', 'TEAM', 'ENTERPRISE']).default('PERSONAL'),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(50).optional(),
});

export const addWorkspaceMemberSchema = z.object({
  userId: z.string().uuid('Valid user ID is required'),
  role: z.enum(['ADMIN', 'MEMBER', 'GUEST']).default('MEMBER'),
});

export const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().nullable(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
