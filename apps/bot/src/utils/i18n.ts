/**
 * FlowTask Bot — Amharic (አማርኛ) Language Pack
 * Covers core bot responses. Add more keys as commands are expanded.
 */
export const am = {
  welcome: (name: string) =>
    `👋 *እንኳን ደህና መጡ፣ ${name}!*\n\nFlowTask — የቡድን ስራ ማስተዳደሪያ ቦት ነው።\n\nፈጣን ትዕዛዞች:\n• \`/task\` — አዲስ ሥራ ፍጠር\n• \`/today\` — የዛሬ ሥራዎች\n• \`/tasks\` — ሁሉም ሥራዎች\n• \`/help\` — ሁሉም ትዕዛዞች`,

  taskCreated: (title: string) => `✅ *ሥራ ተፈጠረ!*\n📝 *ርዕስ:* ${title}`,

  taskDone: (title: string) => `✅ *ሥራ ተጠናቋል!*\n"${title}" ተጠናቅቋል።`,

  noTasks: `📭 *ምንም ሥራ የለም።*\nለመጀመር \`/task\` ይጠቀሙ።`,

  todayTasks: (count: number) =>
    `📅 *የዛሬ ሥራዎቻቸዎ — ${count} ሥራ*`,

  overdueAlert: (count: number) =>
    `🚨 *${count} ሥራ ጊዜው አልፎበታል!*\nወዲያውኑ ይጠናቀቁ።`,

  upgradeRequired: `🔒 *ይህ ባህሪ ፕሮ ፕላን ይፈልጋል።*\nወደ PRO ያሻሽሉ።`,

  help: `🤖 *FlowTask ትዕዛዞች*\n\n` +
    `📝 \`/task [ርዕስ]\` — አዲስ ሥራ ፍጠር\n` +
    `📋 \`/tasks\` — ሁሉም ሥራዎች\n` +
    `📅 \`/today\` — የዛሬ ሥራዎቻቸዎ\n` +
    `👤 \`/assigned\` — ለእርስዎ የተሰጡ ሥራዎች\n` +
    `🚨 \`/overdue\` — ጊዜ ያለፈባቸው ሥራዎች\n` +
    `🏆 \`/leaderboard\` — ሳምንታዊ ደረጃ\n` +
    `📊 \`/stats\` — ስታቲስቲክስ\n` +
    `🎙️ \`/meeting\` — ስብሰባ ቅዳ\n` +
    `🤖 \`/ai [ሐሳብ]\` — AI የፕሮጀክት ዕቅድ (PRO)\n` +
    `❓ \`/help\` — ይህን ዝርዝር አሳይ`,
} as const;

export const en = {
  welcome: (name: string) =>
    `👋 *Welcome to FlowTask, ${name}!*\n\nTurn Telegram into organized work.\n\nQuick commands:\n• \`/task\` — Create a task\n• \`/today\` — Today's tasks\n• \`/tasks\` — All tasks\n• \`/help\` — All commands`,

  taskCreated: (title: string) => `✅ *Task Created!*\n📝 *Title:* ${title}`,

  taskDone: (title: string) => `✅ *Task Completed!*\n"${title}" is done.`,

  noTasks: `📭 *No tasks found.*\nUse \`/task\` to get started.`,

  todayTasks: (count: number) =>
    `📅 *Your Tasks for Today — ${count} task(s)*`,

  overdueAlert: (count: number) =>
    `🚨 *${count} task(s) are overdue!*\nPlease complete them immediately.`,

  upgradeRequired: `🔒 *This feature requires a PRO plan.*\nUpgrade to unlock it.`,

  help: `🤖 *FlowTask Commands*\n\n` +
    `📝 \`/task [title]\` — Create a task\n` +
    `📋 \`/tasks\` — All tasks\n` +
    `📅 \`/today\` — Your tasks today\n` +
    `👤 \`/assigned\` — Tasks assigned to you\n` +
    `🚨 \`/overdue\` — Overdue tasks\n` +
    `🏆 \`/leaderboard\` — Weekly leaderboard\n` +
    `📊 \`/stats\` — Workspace analytics\n` +
    `🎙️ \`/meeting\` — Schedule a meeting\n` +
    `🤖 \`/ai [idea]\` — AI Project Manager (PRO)\n` +
    `❓ \`/help\` — Show this list`,
} as const;

export type Lang = 'am' | 'en';
export type I18nStrings = typeof en;

const translations: Record<Lang, I18nStrings> = { am, en };

/**
 * Returns the translation object for a given language code.
 * Falls back to English if the language is not supported.
 */
export function t(lang: string | undefined | null): I18nStrings {
  const code = (lang || 'en').toLowerCase();
  return translations[code as Lang] ?? translations.en;
}
