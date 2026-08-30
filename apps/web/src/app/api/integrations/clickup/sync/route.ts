import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // 1. Fetch Authorized Teams from ClickUp
    const teamRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: {
        Authorization: apiKey.trim(),
        'Content-Type': 'application/json',
      },
    });

    if (!teamRes.ok) {
      const errorText = await teamRes.text();
      return NextResponse.json(
        { error: `ClickUp API Auth Failed (${teamRes.status}): ${errorText}` },
        { status: 401 }
      );
    }

    const teamData = await teamRes.json();
    const teams = teamData.teams || [];

    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'No ClickUp Workspaces/Teams found for this token.' },
        { status: 404 }
      );
    }

    const primaryTeamId = teams[0].id;
    const teamName = teams[0].name || 'ClickUp Workspace';

    // 2. Fetch Tasks from ClickUp Team
    let tasks: any[] = [];
    try {
      const taskRes = await fetch(
        `https://api.clickup.com/api/v2/team/${primaryTeamId}/task?include_closed=true&subtasks=true`,
        {
          headers: {
            Authorization: apiKey.trim(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (taskRes.ok) {
        const taskData = await taskRes.json();
        tasks = taskData.tasks || [];
      }
    } catch (e: any) {
      console.warn('Could not fetch team tasks, falling back to spaces:', e.message);
    }

    return NextResponse.json({
      success: true,
      teamId: primaryTeamId,
      teamName,
      taskCount: tasks.length,
      tasks: tasks.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.text_content || t.description || '',
        status: mapClickUpStatus(t.status?.status),
        priority: mapClickUpPriority(t.priority?.priority),
        dueDate: t.due_date ? new Date(parseInt(t.due_date, 10)).toISOString() : null,
        project: t.space?.name || t.list?.name || 'ClickUp Backlog',
        url: t.url,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

function mapClickUpStatus(statusStr?: string): 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' {
  if (!statusStr) return 'TODO';
  const s = statusStr.toLowerCase();
  if (s.includes('done') || s.includes('complete') || s.includes('closed')) return 'DONE';
  if (s.includes('review') || s.includes('qa')) return 'IN_REVIEW';
  if (s.includes('progress') || s.includes('doing') || s.includes('dev')) return 'IN_PROGRESS';
  return 'TODO';
}

function mapClickUpPriority(p?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
  if (!p) return 'MEDIUM';
  const pr = p.toLowerCase();
  if (pr.includes('urgent')) return 'URGENT';
  if (pr.includes('high')) return 'HIGH';
  if (pr.includes('low')) return 'LOW';
  return 'MEDIUM';
}
