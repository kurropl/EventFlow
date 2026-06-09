/**
 * EventFlow — Worker Contract Upload
 * POST /api/staffing/workers/[id]/contract — Upload contract file
 * DELETE /api/staffing/workers/[id]/contract — Remove contract
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { verifyToken } from '@/lib/auth';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return { authenticated: false, error: 'No autenticado' };
  const user = verifyToken(token);
  if (!user) return { authenticated: false, error: 'Token inválido' };
  return { authenticated: true };
}

const UPLOAD_DIR = '/root/eventflow/public/uploads/contracts';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { id } = params;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ success: false, error: 'No se proporcionó archivo' }, { status: 422 });

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Tipo de archivo no permitido. Use PDF, JPG, PNG o DOC/DOCX' }, { status: 422 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'El archivo no puede superar 10MB' }, { status: 422 });
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Save file
    const ext = file.name.split('.').pop() || 'pdf';
    const filename = `${id}_${Date.now()}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Update worker record
    const contractUrl = `/uploads/contracts/${filename}`;
    await querySingle<any>(
      `UPDATE workers SET contract_url = $1, contract_name = $2 WHERE id = $3 RETURNING id, contract_url, contract_name`,
      [contractUrl, file.name, id]
    );

    return NextResponse.json({ success: true, data: { contract_url: contractUrl, contract_name: file.name } });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { id } = params;

    // Get current contract
    const worker = await querySingle<any>(
      `SELECT contract_url FROM workers WHERE id = $1`, [id]
    );

    if (worker?.contract_url) {
      // Delete file
      const filepath = join('/root/eventflow/public', worker.contract_url);
      if (existsSync(filepath)) {
        await unlink(filepath);
      }
    }

    // Clear contract from DB
    await querySingle<any>(
      `UPDATE workers SET contract_url = NULL, contract_name = NULL WHERE id = $1 RETURNING id`, [id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
