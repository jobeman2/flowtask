import { NextRequest, NextResponse } from 'next/server';

export interface ClassifiedTask {
  id: string;
  title: string;
  description: string;
  domain: string;
  domainColor: string;
  suggestedAssigneeName?: string;
  suggestedAssigneeId?: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueInDays: number;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, workspaceMembers = [] } = await req.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Please provide a project idea or prompt.' }, { status: 400 });
    }

    const cleanPrompt = prompt.trim();
    const geminiKey = process.env.GEMINI_API_KEY;

    let tasks: ClassifiedTask[];

    if (geminiKey) {
      tasks = await classifyWithGemini(cleanPrompt, workspaceMembers, geminiKey);
    } else {
      // Fallback to rule-based classification when no key is configured
      tasks = generateClassifiedTasks(cleanPrompt, workspaceMembers);
    }

    return NextResponse.json({
      success: true,
      prompt: cleanPrompt,
      taskCount: tasks.length,
      tasks,
      engine: geminiKey ? 'gemini' : 'rules',
    });
  } catch (err: any) {
    console.error('[AI Project Manager]', err);
    return NextResponse.json({ error: err.message || 'AI Classification Failed' }, { status: 500 });
  }
}

async function classifyWithGemini(
  prompt: string,
  members: any[],
  apiKey: string
): Promise<ClassifiedTask[]> {
  const memberList = members
    .map((m: any, i: number) => `${i + 1}. ${m.user?.name || m.name || 'Member'} (role: ${m.role || 'member'})`)
    .join('\n') || '1. Team Lead (role: owner)';

  const systemPrompt = `You are a senior project manager AI. Given a project idea or sprint goal, break it into 3-6 specific, actionable tasks. Assign each task to a team member from the provided list based on their role.

Respond ONLY with a valid JSON array. Each object must have these exact fields:
- title: string (concise, action-oriented, max 80 chars)
- description: string (1-2 sentences with technical details)
- domain: string (e.g. "Backend / API", "Frontend / UI", "Telegram Bot", "Marketing", "QA & Testing", "DevOps")
- domainColor: string (hex color matching domain: Backend=#2563eb, Frontend=#8b5cf6, Bot=#0ea5e9, Marketing=#f59e0b, QA=#10b981, DevOps=#6366f1)
- suggestedAssigneeName: string (name from team member list)
- suggestedAssigneeId: string (use index like "member-1" if no real IDs)
- priority: string (one of: URGENT, HIGH, MEDIUM, LOW)
- dueInDays: number (1-14, realistic estimate)

Team members:
${memberList}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: `Project goal: ${prompt}` }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} — ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

  let parsed: any[];
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Try to extract JSON array from wrapped response
    const match = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!match) throw new Error('Gemini returned non-JSON response.');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed)) throw new Error('Gemini response was not an array.');

  // Map member names to real IDs from workspace
  const memberMap = new Map<string, { id: string; name: string }>();
  members.forEach((m: any) => {
    const name = (m.user?.name || m.name || '').toLowerCase();
    const id = m.user?.id || m.id || '';
    if (name) memberMap.set(name, { id, name: m.user?.name || m.name });
  });

  return parsed.slice(0, 8).map((t: any, i: number) => {
    const assigneeName = t.suggestedAssigneeName || '';
    const matched = memberMap.get(assigneeName.toLowerCase());
    return {
      id: `ai-task-${Date.now()}-${i}`,
      title: String(t.title || 'Untitled Task').slice(0, 100),
      description: String(t.description || ''),
      domain: String(t.domain || 'Engineering'),
      domainColor: String(t.domainColor || '#2563eb'),
      suggestedAssigneeName: matched?.name || assigneeName || 'Team Lead',
      suggestedAssigneeId: matched?.id || '',
      priority: (['URGENT', 'HIGH', 'MEDIUM', 'LOW'].includes(t.priority) ? t.priority : 'MEDIUM') as ClassifiedTask['priority'],
      dueInDays: typeof t.dueInDays === 'number' ? Math.min(Math.max(t.dueInDays, 1), 30) : 3,
    };
  });
}

// Rule-based fallback (used when GEMINI_API_KEY is not set)
function generateClassifiedTasks(prompt: string, members: any[]): ClassifiedTask[] {
  const lower = prompt.toLowerCase();
  const tasks: ClassifiedTask[] = [];

  const getMemberByRole = (roleHint: string) => {
    if (!members.length) return { id: undefined, name: 'Team Lead' };
    const found = members.find((m: any) => {
      const name = (m.user?.name || m.name || '').toLowerCase();
      const role = (m.role || '').toLowerCase();
      return name.includes(roleHint) || role.includes(roleHint);
    });
    const fallback = members[tasks.length % members.length];
    const target = found || fallback;
    return { id: target?.user?.id || target?.id, name: target?.user?.name || target?.name || 'Teammate' };
  };

  if (lower.includes('telebirr') || lower.includes('payment') || lower.includes('checkout') || lower.includes('billing')) {
    const dev = getMemberByRole('dev');
    const design = getMemberByRole('design');
    tasks.push({ id: `ai-task-${Date.now()}-1`, title: 'Implement Telebirr Webhook Endpoint & Signature Verifier', description: 'Build secure callback webhook to process instant Telebirr payment receipts and sync DB status.', domain: 'Backend / API', domainColor: '#2563eb', suggestedAssigneeId: dev.id, suggestedAssigneeName: dev.name, priority: 'HIGH', dueInDays: 2 });
    tasks.push({ id: `ai-task-${Date.now()}-2`, title: 'Design & Build 1-Tap Telebirr Payment Modal Sheet', description: 'Create responsive mobile checkout sheet inside Telegram Mini App with copy USSD code and countdown timer.', domain: 'Frontend / UI', domainColor: '#8b5cf6', suggestedAssigneeId: design.id, suggestedAssigneeName: design.name, priority: 'HIGH', dueInDays: 3 });
    tasks.push({ id: `ai-task-${Date.now()}-3`, title: 'Automated SMS Receipt & DM Notification Bot Handler', description: 'Send instant payment confirmation receipt and active subscription badge directly to user on Telegram.', domain: 'Telegram Bot', domainColor: '#0ea5e9', suggestedAssigneeId: dev.id, suggestedAssigneeName: dev.name, priority: 'MEDIUM', dueInDays: 4 });
  } else if (lower.includes('auth') || lower.includes('login') || lower.includes('security')) {
    const dev = getMemberByRole('dev');
    tasks.push({ id: `ai-task-${Date.now()}-4`, title: 'Telegram Mini App Session Token Rotation & Auth Guard', description: 'Validate Telegram WebApp initData HMAC sha256 signatures and issue secure JWT session tokens.', domain: 'Security / Auth', domainColor: '#ef4444', suggestedAssigneeId: dev.id, suggestedAssigneeName: dev.name, priority: 'URGENT', dueInDays: 1 });
  } else if (lower.includes('design') || lower.includes('ui') || lower.includes('theme')) {
    const designer = getMemberByRole('design');
    tasks.push({ id: `ai-task-${Date.now()}-5`, title: 'Design System & Dark Mode Tailwind Palette Refactor', description: 'Refactor color tokens, typography scales, and haptic feedback micro-interactions for modern Mini App UI.', domain: 'UI / Design', domainColor: '#ec4899', suggestedAssigneeId: designer.id, suggestedAssigneeName: designer.name, priority: 'MEDIUM', dueInDays: 3 });
  } else if (lower.includes('marketing') || lower.includes('launch') || lower.includes('social')) {
    const lead = getMemberByRole('lead');
    tasks.push({ id: `ai-task-${Date.now()}-6`, title: 'Create Launch Banners & Telegram Community Announcement', description: 'Design social media launch flyers, write feature highlights changelog, and prepare broadcast pin message.', domain: 'Marketing / Growth', domainColor: '#f59e0b', suggestedAssigneeId: lead.id, suggestedAssigneeName: lead.name, priority: 'MEDIUM', dueInDays: 4 });
  } else {
    const dev = getMemberByRole('dev');
    const design = getMemberByRole('design');
    const lead = getMemberByRole('lead');
    tasks.push({ id: `ai-task-${Date.now()}-7`, title: `Architect & Scaffold: ${capitalize(prompt)}`, description: `Define technical specs, DB schema, and API endpoints for: ${prompt}.`, domain: 'Engineering', domainColor: '#2563eb', suggestedAssigneeId: dev.id, suggestedAssigneeName: dev.name, priority: 'HIGH', dueInDays: 2 });
    tasks.push({ id: `ai-task-${Date.now()}-8`, title: `Build Interactive UI for ${capitalize(prompt)}`, description: `Create Telegram Mini App components, forms, and validation states for ${prompt}.`, domain: 'Frontend / UI', domainColor: '#8b5cf6', suggestedAssigneeId: design.id, suggestedAssigneeName: design.name, priority: 'HIGH', dueInDays: 3 });
    tasks.push({ id: `ai-task-${Date.now()}-9`, title: 'Quality Assurance & Telegram Group Testing', description: 'End-to-end sandbox verification, edge cases testing, and bot responsiveness checks.', domain: 'QA & Testing', domainColor: '#10b981', suggestedAssigneeId: lead.id, suggestedAssigneeName: lead.name, priority: 'MEDIUM', dueInDays: 5 });
  }

  return tasks;
}

function capitalize(s: string) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
