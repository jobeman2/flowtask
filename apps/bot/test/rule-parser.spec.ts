import { describe, it, expect } from 'vitest';
import { parseTaskMessage } from '../src/utils/rule-parser';
import { TaskPriority } from '@flowtask/database';

describe('Deterministic Rule Parser (Zero AI)', () => {
  const mockNow = new Date('2026-08-24T10:00:00.000Z');

  it('should extract title and priority tags deterministically', () => {
    const input = 'Prepare quarterly investor deck !urgent';
    const result = parseTaskMessage(input, mockNow);

    expect(result.title).toBe('Prepare quarterly investor deck');
    expect(result.priority).toBe(TaskPriority.URGENT);
  });

  it('should extract project, labels and assignee mentions', () => {
    const input = 'Review API security +CoreBackend #security #v1 @jovany_dev';
    const result = parseTaskMessage(input, mockNow);

    expect(result.title).toBe('Review API security');
    expect(result.projectName).toBe('CoreBackend');
    expect(result.labels).toEqual(['security', 'v1']);
    expect(result.assigneeUsername).toBe('jovany_dev');
  });

  it('should compute relative dates mathematically', () => {
    const input = 'Submit tax returns tomorrow at 5pm';
    const result = parseTaskMessage(input, mockNow);

    expect(result.title).toBe('Submit tax returns');
    expect(result.dueDate).toBeDefined();
    expect(result.dueDate?.getHours()).toBe(17);
  });

  it('should extract recurrence and reminder tokens', () => {
    const input = 'Weekly sprint retrospective every monday 10am remind:15m';
    const result = parseTaskMessage(input, mockNow);

    expect(result.title).toBe('Weekly sprint retrospective');
    expect(result.isRecurring).toBe(true);
    expect(result.recurrenceRule).toBe('WEEKLY:MONDAY');
    expect(result.reminderMinutes).toBe(15);
  });

  it('should parse explicit ISO due dates', () => {
    const input = 'Client deliverable milestone due:2026-09-15';
    const result = parseTaskMessage(input, mockNow);

    expect(result.title).toBe('Client deliverable milestone');
    expect(result.dueDate?.toISOString().startsWith('2026-09-15')).toBe(true);
  });
});
