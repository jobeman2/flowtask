import { TaskPriority } from '@flowtask/database';

interface AiTask {
  title: string;
  description: string;
  priority: TaskPriority;
  dueInDays: number;
  assigneeId: string;
  assigneeName: string;
}

export async function generateSprintPlan(
  prompt: string,
  members: Array<{ user: { id: string; name: string }; role: string }>
): Promise<AiTask[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      return await callGemini(prompt, members, apiKey);
    } catch (err: any) {
      console.warn('[Gemini Bot] API call failed, using rules fallback:', err.message);
    }
  }

  return rulesBasedPlan(prompt, members);
}

async function callGemini(
  prompt: string,
  members: Array<{ user: { id: string; name: string }; role: string }>,
  apiKey: string
): Promise<AiTask[]> {
  const memberList = members
    .map((m, i) => `${i + 1}. ${m.user.name} (role: ${m.role})`)
    .join('\n') || '1. Team Lead (role: owner)';

  const systemPrompt = `You are a senior project manager. Break the following project goal into 3-5 specific actionable tasks. Assign each to a team member.

Respond ONLY with a valid JSON array. Each item must have:
- title: string (max 80 chars, action-oriented)
- description: string (1-2 sentences)
- priority: one of URGENT, HIGH, MEDIUM, LOW
- dueInDays: number (1-14)
- assigneeName: string (name from team list below)

Team members:
${memberList}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: `Project goal: ${prompt}` }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) throw new Error(`Gemini API HTTP ${res.status}`);

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

  let parsed: any[];
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!match) throw new Error('Non-JSON response from Gemini');
    parsed = JSON.parse(match[0]);
  }

  const nameMap = new Map<string, { id: string; name: string }>();
  members.forEach(m => nameMap.set(m.user.name.toLowerCase(), { id: m.user.id, name: m.user.name }));

  const priorityMap: Record<string, TaskPriority> = {
    URGENT: TaskPriority.URGENT,
    HIGH: TaskPriority.HIGH,
    MEDIUM: TaskPriority.MEDIUM,
    LOW: TaskPriority.LOW,
  };

  return parsed.slice(0, 6).map((t: any) => {
    const matched = nameMap.get((t.assigneeName || '').toLowerCase());
    const fallback = members[0];
    return {
      title: String(t.title || 'Task').slice(0, 100),
      description: String(t.description || ''),
      priority: priorityMap[t.priority] || TaskPriority.MEDIUM,
      dueInDays: typeof t.dueInDays === 'number' ? Math.min(Math.max(t.dueInDays, 1), 14) : 3,
      assigneeId: matched?.id || fallback?.user?.id || '',
      assigneeName: matched?.name || t.assigneeName || fallback?.user?.name || 'Team Lead',
    };
  });
}

function rulesBasedPlan(
  prompt: string,
  members: Array<{ user: { id: string; name: string }; role: string }>
): AiTask[] {
  const lower = prompt.toLowerCase();
  const dev = members.find(m => m.role === 'MEMBER' || m.user.name.toLowerCase().includes('dev')) || members[0];
  const lead = members.find(m => m.role === 'OWNER' || m.role === 'ADMIN') || members[0];
  const devInfo = { assigneeId: dev?.user?.id || '', assigneeName: dev?.user?.name || 'Dev' };
  const leadInfo = { assigneeId: lead?.user?.id || '', assigneeName: lead?.user?.name || 'Lead' };

  if (lower.includes('telebirr') || lower.includes('payment')) {
    return [
      { title: 'Implement Telebirr Webhook & Signature Verification', description: 'Backend REST callback endpoint for instant payment receipt processing.', priority: TaskPriority.HIGH, dueInDays: 2, ...devInfo },
      { title: 'Build Telebirr 1-Tap Payment Sheet UI', description: 'Telegram Mini App modal sheet with copy USSD and countdown timer.', priority: TaskPriority.HIGH, dueInDays: 3, ...leadInfo },
      { title: 'Automated Receipt Notification Bot Handler', description: 'Send payment confirmation receipt and active badge in Telegram.', priority: TaskPriority.MEDIUM, dueInDays: 4, ...devInfo },
    ];
  }

  return [
    { title: `Architect & Core Logic: ${prompt.slice(0, 40)}`, description: `Backend implementation for: ${prompt}.`, priority: TaskPriority.HIGH, dueInDays: 2, ...devInfo },
    { title: `User Interface: ${prompt.slice(0, 40)}`, description: `Frontend components and client flow for: ${prompt}.`, priority: TaskPriority.HIGH, dueInDays: 3, ...leadInfo },
    { title: 'QA Testing & Telegram Group Sandbox Verification', description: 'End-to-end verification and performance check.', priority: TaskPriority.MEDIUM, dueInDays: 5, ...devInfo },
  ];
}
