/**
 * GET /mapa-mesas.html
 * Serves the standalone mapa-mesas HTML page
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('event_id');
    const eventName = searchParams.get('event_name');
    
    let html = readFileSync(join(process.cwd(), 'public', 'mapa-mesas.html'), 'utf-8');
    
    // Inject event_id as a script tag before </body>
    const eventScript = `<script>window.__EVENT_ID__ = "${eventId || ''}";${eventName ? `window.__EVENT_NAME__ = "${eventName.replace(/"/g, '\\"')}"`; : ''}</script>`;
    html = html.replace('</body>', eventScript + '</body>');
    
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (e: any) {
    console.error('Error serving mapa-mesas:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
