/**
 * POST /api/upload/recipe-photo — Foto de la ficha técnica de una receta
 * Mismo patrón que /api/upload/receipt (extensión derivada del content-type,
 * nombre aleatorio, allowlist), con autenticación de admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { verifyToken } from '@/lib/auth';

const TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: NextRequest) {
  try {
    const token =
      request.cookies.get('admin_session')?.value ||
      request.cookies.get('eventflow_token')?.value;
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No se ha enviado ningún archivo' }, { status: 400 });
    }

    const ext = TYPE_TO_EXT[file.type];
    if (!ext) {
      return NextResponse.json({ success: false, error: 'Formato no válido. Usa JPG, PNG o WebP.' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'El archivo excede 5MB.' }, { status: 400 });
    }

    const fileName = `receta-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'recetas');
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadDir, fileName);
    if (!filePath.startsWith(uploadDir)) {
      return NextResponse.json({ success: false, error: 'Ruta no válida' }, { status: 400 });
    }
    await writeFile(filePath, buffer);

    return NextResponse.json({ success: true, data: { url: `/uploads/recetas/${fileName}` } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
