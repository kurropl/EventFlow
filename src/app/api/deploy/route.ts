import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    
    if (action === 'deploy') {
      // Pull latest changes from GitHub
      await execAsync('cd /root/eventflow && git pull origin main', { timeout: 60000 });
      
      // Build the app
      await execAsync('cd /root/eventflow && npm run build', { timeout: 300000 });
      
      // Copy static files
      await execAsync('cd /root/eventflow && cp -r .next/static .next/standalone/.next/static', { timeout: 10000 });
      
      // Restart the server
      await execAsync('pkill -9 -f "node server.js" 2>/dev/null || true', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      await execAsync('cd /root/eventflow/.next/standalone && PORT=3020 node server.js &', { timeout: 5000 });
      
      return NextResponse.json({ success: true, message: 'Deploy completed successfully' });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
