import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * POST /api/upload/receipt
 * Upload a payment receipt file.
 * Security: extension derived from content-type (not filename), random name, allowlist.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Content-type → extension map (whitelist)
    const TYPE_TO_EXT: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };

    const ext = TYPE_TO_EXT[file.type];
    if (!ext) {
      return NextResponse.json({ success: false, error: 'Formato no válido. Usa JPG, PNG, WebP o PDF.' }, { status: 400 });
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'El archivo excede 5MB.' }, { status: 400 });
    }

    // Random name — no user-controlled input in filename
    const fileName = `receipt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'receipts');

    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filePath = path.join(uploadDir, fileName);
    // Defense: ensure the resolved path is inside the upload directory
    if (!filePath.startsWith(uploadDir)) {
      return NextResponse.json({ success: false, error: 'Ruta no válida' }, { status: 400 });
    }

    await writeFile(filePath, buffer);

    const url = `/uploads/receipts/${fileName}`;
    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
