/**
 * EventFlow — Automation Rules API
 * GET  /api/automation-rules — list all rules
 * POST /api/automation-rules — create a rule
 */

import { NextResponse } from 'next/server';
import { getRules, createRule, getLogs } from '@/lib/automation';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');

    if (scope === 'logs') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
      const offset = parseInt(url.searchParams.get('offset') ?? '0');
      const ruleId = url.searchParams.get('ruleId') ?? undefined;
      const logs = await getLogs(limit, offset, ruleId);
      return NextResponse.json({ success: true, data: logs });
    }

    const rules = await getRules();
    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name is required (min 2 characters)' },
        { status: 400 }
      );
    }
    if (!body.trigger_topic || typeof body.trigger_topic !== 'string') {
      return NextResponse.json(
        { success: false, error: 'trigger_topic is required' },
        { status: 400 }
      );
    }

    const rule = await createRule({
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      trigger_topic: body.trigger_topic,
      match_type: body.match_type ?? 'all',
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
      actions: Array.isArray(body.actions) ? body.actions : [],
      cooldown_minutes: typeof body.cooldown_minutes === 'number' ? body.cooldown_minutes : 0,
    });

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
