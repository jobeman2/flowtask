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
    const tasks = generateClassifiedTasks(cleanPrompt, workspaceMembers);

    return NextResponse.json({
      success: true,
      prompt: cleanPrompt,
      taskCount: tasks.length,
      tasks,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI Classification Failed' }, { status: 500 });
  }
}

function generateClassifiedTasks(prompt: string, members: any[]): ClassifiedTask[] {
  const lower = prompt.toLowerCase();
  const tasks: ClassifiedTask[] = [];

  // Member resolver helper
  const getMemberByRole = (roleHint: string) => {
    if (!members.length) return { id: undefined, name: 'Team Lead' };
    const found = members.find((m: any) => {
      const name = (m.user?.name || m.name || '').toLowerCase();
      const role = (m.role || '').toLowerCase();
      return name.includes(roleHint) || role.includes(roleHint);
    });
    const fallback = members[tasks.length % members.length];
    const target = found || fallback;
    return {
      id: target?.user?.id || target?.id,
      name: target?.user?.name || target?.name || 'Teammate',
    };
  };

  // 1. Payment / Telebirr keywords
  if (lower.includes('telebirr') || lower.includes('payment') || lower.includes('checkout') || lower.includes('billing')) {
    const dev = getMemberByRole('dev');
    const design = getMemberByRole('design');

    tasks.push({
      id: `ai-task-${Date.now()}-1`,
      title: 'Implement Telebirr Webhook Endpoint & Signature Verifier',
      description: 'Build secure callback webhook endpoint to process instant Telebirr mobile payment receipts and database status sync.',
      domain: 'Backend / API',
      domainColor: '#2563eb',
      suggestedAssigneeId: dev.id,
      suggestedAssigneeName: dev.name,
      priority: 'HIGH',
      dueInDays: 2,
    });

    tasks.push({
      id: `ai-task-${Date.now()}-2`,
      title: 'Design & Build 1-Tap Telebirr Payment Modal Sheet',
      description: 'Create responsive mobile checkout sheet inside Telegram Mini App with copy USSD code and countdown timer.',
      domain: 'Frontend / UI',
      domainColor: '#8b5cf6',
      suggestedAssigneeId: design.id,
      suggestedAssigneeName: design.name,
      priority: 'HIGH',
      dueInDays: 3,
    });

    tasks.push({
      id: `ai-task-${Date.now()}-3`,
      title: 'Automated SMS Receipt & DM Notification Bot Handler',
      description: 'Send instant payment confirmation receipt and active subscription badge directly to the user on Telegram.',
      domain: 'Telegram Bot',
      domainColor: '#0ea5e9',
      suggestedAssigneeId: dev.id,
      suggestedAssigneeName: dev.name,
      priority: 'MEDIUM',
      dueInDays: 4,
    });
  }

  // 2. Auth / Security / User keywords
  if (lower.includes('auth') || lower.includes('login') || lower.includes('signup') || lower.includes('user') || lower.includes('security')) {
    const dev = getMemberByRole('dev');
    tasks.push({
      id: `ai-task-${Date.now()}-4`,
      title: 'Telegram Mini App Session Token Rotation & Auth Guard',
      description: 'Validate Telegram WebApp initData HMAC sha256 signatures and issue secure JWT session tokens.',
      domain: 'Security / Auth',
      domainColor: '#ef4444',
      suggestedAssigneeId: dev.id,
      suggestedAssigneeName: dev.name,
      priority: 'URGENT',
      dueInDays: 1,
    });
  }

  // 3. Design / UI / Landing page keywords
  if (lower.includes('design') || lower.includes('ui') || lower.includes('ux') || lower.includes('landing') || lower.includes('theme')) {
    const designer = getMemberByRole('design');
    tasks.push({
      id: `ai-task-${Date.now()}-5`,
      title: 'Design System & Dark Mode Tailwind Palette Refactor',
      description: 'Refactor color tokens, typography scales, and haptic feedback micro-interactions for modern iOS/Android Mini App UI.',
      domain: 'UI / Design',
      domainColor: '#ec4899',
      suggestedAssigneeId: designer.id,
      suggestedAssigneeName: designer.name,
      priority: 'MEDIUM',
      dueInDays: 3,
    });
  }

  // 4. Marketing / Launch / Promotion keywords
  if (lower.includes('marketing') || lower.includes('launch') || lower.includes('social') || lower.includes('post') || lower.includes('flyer')) {
    const lead = getMemberByRole('lead');
    tasks.push({
      id: `ai-task-${Date.now()}-6`,
      title: 'Create Launch Banners & Telegram Community Announcement',
      description: 'Design social media launch flyers, write feature highlights changelog, and prepare broadcast pin message.',
      domain: 'Marketing / Growth',
      domainColor: '#f59e0b',
      suggestedAssigneeId: lead.id,
      suggestedAssigneeName: lead.name,
      priority: 'MEDIUM',
      dueInDays: 4,
    });
  }

  // 5. General fallback / Custom Decomposition if prompt is generic
  if (tasks.length === 0) {
    const dev = getMemberByRole('dev');
    const design = getMemberByRole('design');
    const lead = getMemberByRole('lead');

    tasks.push({
      id: `ai-task-${Date.now()}-7`,
      title: `Architect & Scaffold: ${capitalize(prompt)}`,
      description: `Define technical specifications, database schema modifications, and API endpoints for: ${prompt}.`,
      domain: 'Engineering',
      domainColor: '#2563eb',
      suggestedAssigneeId: dev.id,
      suggestedAssigneeName: dev.name,
      priority: 'HIGH',
      dueInDays: 2,
    });

    tasks.push({
      id: `ai-task-${Date.now()}-8`,
      title: `Build Interactive UI & Client Views for ${capitalize(prompt)}`,
      description: `Create modern Telegram Mini App components, forms, and validation states for ${prompt}.`,
      domain: 'Frontend / UI',
      domainColor: '#8b5cf6',
      suggestedAssigneeId: design.id,
      suggestedAssigneeName: design.name,
      priority: 'HIGH',
      dueInDays: 3,
    });

    tasks.push({
      id: `ai-task-${Date.now()}-9`,
      title: `Quality Assurance & Telegram Group Testing`,
      description: `Perform end-to-end sandbox verification, edge cases testing, and bot responsiveness checks.`,
      domain: 'QA & Operations',
      domainColor: '#10b981',
      suggestedAssigneeId: lead.id,
      suggestedAssigneeName: lead.name,
      priority: 'MEDIUM',
      dueInDays: 5,
    });
  }

  return tasks;
}

function capitalize(s: string) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
