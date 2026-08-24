import { TaskPriority } from '@flowtask/database';

export interface ParsedTaskInput {
  raw: string;
  title: string;
  priority: TaskPriority;
  projectName?: string;
  labels: string[];
  assigneeUsername?: string;
  dueDate: Date | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  reminderMinutes: number | null;
}

/**
 * 100% Deterministic rule-based task extractor.
 * Zero-AI, completely predictable and mathematical.
 */
export function parseTaskMessage(rawText: string, referenceDate: Date = new Date()): ParsedTaskInput {
  let text = rawText.trim();

  // 1. Extract Priority (!urgent, !high, !med, !low, p1, p2, p3, p4)
  let priority = TaskPriority.MEDIUM;
  const priorityPatterns = [
    { regex: /\b(!urgent|!crit|!critical|p1)\b/i, value: TaskPriority.URGENT },
    { regex: /\b(!high|!important|p2)\b/i, value: TaskPriority.HIGH },
    { regex: /\b(!med|!medium|!normal|p3)\b/i, value: TaskPriority.MEDIUM },
    { regex: /\b(!low|!minor|p4)\b/i, value: TaskPriority.LOW },
  ];

  for (const { regex, value } of priorityPatterns) {
    if (regex.test(text)) {
      priority = value;
      text = text.replace(regex, ' ');
      break;
    }
  }

  // 2. Extract Project (+projectName or /p:projectName)
  let projectName: string | undefined;
  const projectMatch = text.match(/(?:\+([a-zA-Z0-9_\u00C0-\u017F-]+)|\/p:([a-zA-Z0-9_\u00C0-\u017F-]+))/);
  if (projectMatch) {
    projectName = (projectMatch[1] || projectMatch[2]).trim();
    text = text.replace(projectMatch[0], ' ');
  }

  // 3. Extract Labels (#labelName)
  const labels: string[] = [];
  const labelMatches = text.matchAll(/#([a-zA-Z0-9_\u00C0-\u017F-]+)/g);
  for (const match of labelMatches) {
    labels.push(match[1].trim());
  }
  text = text.replace(/#[a-zA-Z0-9_\u00C0-\u017F-]+/g, ' ');

  // 4. Extract Assignee (@username)
  let assigneeUsername: string | undefined;
  const assigneeMatch = text.match(/@([a-zA-Z0-9_]{5,32})/);
  if (assigneeMatch) {
    assigneeUsername = assigneeMatch[1].trim();
    text = text.replace(assigneeMatch[0], ' ');
  }

  // 5. Extract Recurrence (every day, daily, every week, weekly, every month, monthly, every monday...)
  let isRecurring = false;
  let recurrenceRule: string | null = null;

  const recurrencePatterns = [
    { regex: /\b(every\s+day|daily)\b/i, rule: 'DAILY' },
    { regex: /\b(every\s+week|weekly)\b/i, rule: 'WEEKLY' },
    { regex: /\b(every\s+month|monthly)\b/i, rule: 'MONTHLY' },
    { regex: /\bevery\s+(monday|mon)\b/i, rule: 'WEEKLY:MONDAY' },
    { regex: /\bevery\s+(tuesday|tue)\b/i, rule: 'WEEKLY:TUESDAY' },
    { regex: /\bevery\s+(wednesday|wed)\b/i, rule: 'WEEKLY:WEDNESDAY' },
    { regex: /\bevery\s+(thursday|thu)\b/i, rule: 'WEEKLY:THURSDAY' },
    { regex: /\bevery\s+(friday|fri)\b/i, rule: 'WEEKLY:FRIDAY' },
    { regex: /\bevery\s+(saturday|sat)\b/i, rule: 'WEEKLY:SATURDAY' },
    { regex: /\bevery\s+(sunday|sun)\b/i, rule: 'WEEKLY:SUNDAY' },
  ];

  for (const { regex, rule } of recurrencePatterns) {
    if (regex.test(text)) {
      isRecurring = true;
      recurrenceRule = rule;
      text = text.replace(regex, ' ');
      break;
    }
  }

  // 6. Extract Reminders (remind:15m, remind:1h, remind:1d, remind:tomorrow)
  let reminderMinutes: number | null = null;
  const reminderMatch = text.match(/\bremind:(?:(\d+)(m|min|mins|h|hr|hrs|d|day|days)|(tomorrow|today|1h|15m))\b/i);
  if (reminderMatch) {
    if (reminderMatch[1] && reminderMatch[2]) {
      const num = parseInt(reminderMatch[1], 10);
      const unit = reminderMatch[2].toLowerCase();
      if (unit.startsWith('m')) reminderMinutes = num;
      else if (unit.startsWith('h')) reminderMinutes = num * 60;
      else if (unit.startsWith('d')) reminderMinutes = num * 1440;
    } else if (reminderMatch[3]) {
      const keyword = reminderMatch[3].toLowerCase();
      if (keyword === '15m') reminderMinutes = 15;
      else if (keyword === '1h') reminderMinutes = 60;
      else if (keyword === 'tomorrow') reminderMinutes = 1440;
      else if (keyword === 'today') reminderMinutes = 120;
    }
    text = text.replace(reminderMatch[0], ' ');
  }

  // 7. Extract Due Date & Time (Deterministic mathematical parsing)
  const { dueDate, remainingText } = parseDeterministicDate(text, referenceDate);
  text = remainingText;

  // Clean final task title
  const cleanTitle = text
    .replace(/\s+/g, ' ')
    .replace(/^[-–—:,.\s]+|[-–—:,.\s]+$/g, '')
    .trim();

  return {
    raw: rawText,
    title: cleanTitle || 'Untitled Task',
    priority,
    projectName,
    labels,
    assigneeUsername,
    dueDate,
    isRecurring,
    recurrenceRule,
    reminderMinutes,
  };
}

/**
 * Deterministic Date/Time extractor
 */
function parseDeterministicDate(input: string, ref: Date): { dueDate: Date | null; remainingText: string } {
  let text = input;
  let date: Date | null = null;

  // Explicit due:YYYY-MM-DD
  const isoMatch = text.match(/\bdue:(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?\b/i);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hours = isoMatch[4] ? parseInt(isoMatch[4], 10) : 18;
    const mins = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    date = new Date(Date.UTC(year, month, day, hours, mins));
    text = text.replace(isoMatch[0], ' ');
    return { dueDate: date, remainingText: text };
  }

  // Relative hours/mins/days: "in 2 hours", "in 3 days", "in 30 mins"
  const relMatch = text.match(/\bin\s+(\d+)\s+(mins?|minutes?|hours?|hrs?|days?)\b/i);
  if (relMatch) {
    const amount = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    date = new Date(ref.getTime());
    if (unit.startsWith('m')) date.setMinutes(date.getMinutes() + amount);
    else if (unit.startsWith('h')) date.setHours(date.getHours() + amount);
    else if (unit.startsWith('d')) date.setDate(date.getDate() + amount);
    text = text.replace(relMatch[0], ' ');
  }

  // Day keywords: today, tonight, tomorrow, tmrw
  if (!date) {
    const todayMatch = text.match(/\b(today|tonight|this\s+evening)\b/i);
    if (todayMatch) {
      date = new Date(ref.getTime());
      date.setHours(todayMatch[1].toLowerCase().includes('tonight') ? 20 : 18, 0, 0, 0);
      text = text.replace(todayMatch[0], ' ');
    }
  }

  if (!date) {
    const tmrwMatch = text.match(/\b(tomorrow|tmrw|by\s+tomorrow)\b/i);
    if (tmrwMatch) {
      date = new Date(ref.getTime());
      date.setDate(date.getDate() + 1);
      date.setHours(18, 0, 0, 0);
      text = text.replace(tmrwMatch[0], ' ');
    }
  }

  // Weekdays: "next monday", "on friday", "this thursday", "by friday"
  if (!date) {
    const weekdayMatch = text.match(/\b(?:by\s+|on\s+|next\s+|this\s+)?(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/i);
    if (weekdayMatch) {
      const daysMap: Record<string, number> = {
        sun: 0, sunday: 0,
        mon: 1, monday: 1,
        tue: 2, tuesday: 2,
        wed: 3, wednesday: 3,
        thu: 4, thursday: 4,
        fri: 5, friday: 5,
        sat: 6, saturday: 6,
      };
      const targetDay = daysMap[weekdayMatch[1].toLowerCase()];
      if (targetDay !== undefined) {
        date = new Date(ref.getTime());
        const currentDay = date.getDay();
        let daysToAdd = (targetDay - currentDay + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7; // next occurrence
        date.setDate(date.getDate() + daysToAdd);
        date.setHours(18, 0, 0, 0);
        text = text.replace(weekdayMatch[0], ' ');
      }
    }
  }

  // Extract explicit time of day if specified: "at 5pm", "5:30pm", "14:00", "at 9am"
  const timeMatch = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:at\s+)(\d{1,2}):(\d{2})\b/i);
  if (timeMatch) {
    let hours = 0;
    let minutes = 0;

    if (timeMatch[3]) {
      // 12-hour format with AM/PM
      hours = parseInt(timeMatch[1], 10);
      minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const isPm = timeMatch[3].toLowerCase() === 'pm';
      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
    } else if (timeMatch[4] && timeMatch[5]) {
      // 24-hour format (e.g. at 14:30)
      hours = parseInt(timeMatch[4], 10);
      minutes = parseInt(timeMatch[5], 10);
    }

    if (!date) {
      date = new Date(ref.getTime());
      // If time has already passed today, push to tomorrow
      if (hours < ref.getHours() || (hours === ref.getHours() && minutes <= ref.getMinutes())) {
        date.setDate(date.getDate() + 1);
      }
    }
    date.setHours(hours, minutes, 0, 0);
    text = text.replace(timeMatch[0], ' ');
  }

  return { dueDate: date, remainingText: text };
}
