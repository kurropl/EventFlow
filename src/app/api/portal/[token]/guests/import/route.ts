/**
 * EventFlow — Portal Guests CSV Import API
 * POST /api/portal/[token]/guests/import — Import guests from CSV
 *
 * WP-26: Portal — Invitados y RSVP
 * CSV format: name, group_name, rsvp, menu_type, dietary, notes
 * Max 50 rows per import. Returns detailed error report.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { sanitizeError, securityHeaders } from '@/lib/security';
import { emitDomainEventStandalone } from '@/domain/events';

export const dynamic = 'force-dynamic';

// ============================================================
// Types
// ============================================================

interface ImportRow {
  line: number;
  name: string;
  group_name: string | null;
  rsvp: string;
  menu_type: string;
  dietary: string[];
  notes: string | null;
}

interface ImportError {
  line: number;
  field: string;
  value: string;
  error: string;
}

interface ImportResult {
  success: boolean;
  total_rows: number;
  imported: number;
  errors: ImportError[];
  error_report: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Resolve token to event_id
 */
async function resolveTokenToEventId(token: string): Promise<{
  eventId: string;
  status: string;
} | null> {
  const { querySingle } = await import('@/lib/db');

  // Check client_portals table
  const portal = await querySingle<{
    event_id: string;
    status: string;
  }>(
    `SELECT event_id, status FROM client_portals WHERE access_token = $1`,
    [token]
  );
  if (portal) {
    return { eventId: portal.event_id, status: portal.status };
  }

  // Fallback: check events.client_token
  const event = await querySingle<{ id: string }>(
    `SELECT id FROM events WHERE client_token = $1`,
    [token]
  );
  if (event) {
    return { eventId: event.id, status: 'activo' };
  }

  return null;
}

/**
 * Check if portal is frozen
 */
async function isPortalFrozen(eventId: string): Promise<boolean> {
  const { querySingle } = await import('@/lib/db');
  const portal = await querySingle<{ status: string; freeze_date: string }>(
    `SELECT status, freeze_date::text FROM client_portals WHERE event_id = $1`,
    [eventId]
  );
  if (!portal) return false;
  if (portal.status === 'congelado' || portal.status === 'cerrado') return true;
  if (portal.freeze_date && new Date(portal.freeze_date) <= new Date()) return true;
  return false;
}

/**
 * Parse CSV line (handles quoted fields with commas and newlines)
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());

  return fields;
}

/**
 * Parse CSV content into ImportRow objects
 */
function parseCsv(content: string): { rows: ImportRow[]; parseErrors: ImportError[] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  const rows: ImportRow[] = [];
  const parseErrors: ImportError[] = [];

  // Check header
  if (lines.length === 0) {
    return { rows: [], parseErrors: [] };
  }

  const headerLine = lines[0].toLowerCase();
  const hasHeader =
    headerLine.includes('nombre') ||
    headerLine.includes('name') ||
    headerLine.includes('grupo') ||
    headerLine.includes('group');

  const startLine = hasHeader ? 1 : 0;

  for (let i = startLine; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const lineNum = i + 1;

    if (fields.length < 1 || !fields[0]) {
      parseErrors.push({
        line: lineNum,
        field: 'name',
        value: '',
        error: 'Nombre vacío',
      });
      continue;
    }

    const name = fields[0]?.trim();
    const group_name = fields[1]?.trim() || null;
    const rsvp = normalizeRsvp(fields[2]?.trim());
    const menu_type = normalizeMenuType(fields[3]?.trim());
    const dietary = parseDietary(fields[4]?.trim());
    const notes = fields[5]?.trim() || null;

    // Validate name
    if (!name || name.length > 200) {
      parseErrors.push({
        line: lineNum,
        field: 'name',
        value: name || '',
        error: !name ? 'Nombre requerido' : 'Nombre demasiado largo (máx. 200 caracteres)',
      });
      continue;
    }

    // Validate RSVP
    const rsvpError = validateRsvp(rsvp);
    if (rsvpError) {
      parseErrors.push({
        line: lineNum,
        field: 'rsvp',
        value: rsvp,
        error: rsvpError,
      });
      continue;
    }

    // Validate menu_type
    const menuTypeError = validateMenuType(menu_type);
    if (menuTypeError) {
      parseErrors.push({
        line: lineNum,
        field: 'menu_type',
        value: menu_type,
        error: menuTypeError,
      });
      continue;
    }

    rows.push({
      line: lineNum,
      name,
      group_name,
      rsvp,
      menu_type,
      dietary,
      notes,
    });
  }

  return { rows, parseErrors };
}

/**
 * Normalize RSVP value
 */
function normalizeRsvp(value: string | undefined): string {
  if (!value) return 'pendiente';

  const lower = value.toLowerCase().trim();
  const mappings: Record<string, string> = {
    p: 'pendiente',
    pendiente: 'pendiente',
    pending: 'pendiente',
    no: 'pendiente',
    c: 'confirmado',
    confirmado: 'confirmado',
    confirm: 'confirmado',
    yes: 'confirmado',
    sí: 'confirmado',
    si: 'confirmado',
    r: 'rechazado',
    rechazado: 'rechazado',
    declined: 'rechazado',
    no_asistirá: 'rechazado',
    no asistira: 'rechazado',
  };

  return mappings[lower] || 'pendiente';
}

/**
 * Validate RSVP value
 */
function validateRsvp(value: string): string | null {
  if (!['pendiente', 'confirmado', 'rechazado'].includes(value)) {
    return `RSVP inválido "${value}". Valores: pendiente, confirmado, rechazado`;
  }
  return null;
}

/**
 * Normalize menu type
 */
function normalizeMenuType(value: string | undefined): string {
  if (!value) return 'adulto';

  const lower = value.toLowerCase().trim();
  const mappings: Record<string, string> = {
    a: 'adulto',
    adulto: 'adulto',
    adult: 'adulto',
    n: 'nino',
    niño: 'nino',
    nino: 'nino',
    kid: 'nino',
    child: 'nino',
    infantil: 'nino',
    b: 'bebe',
    bebé: 'bebe',
    bebe: 'bebe',
    baby: 'bebe',
  };

  return mappings[lower] || 'adulto';
}

/**
 * Validate menu type
 */
function validateMenuType(value: string): string | null {
  if (!['adulto', 'nino', 'bebe'].includes(value)) {
    return `Tipo de menú inválido "${value}". Valores: adulto, nino, bebe`;
  }
  return null;
}

/**
 * Parse dietary field (comma-separated or semicolon-separated)
 */
function parseDietary(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];

  // Split by comma or semicolon
  const items = value
    .split(/[,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);

  // Normalize common dietary terms
  const normalized = items.map((item) => {
    const mappings: Record<string, string> = {
      vegetariano: 'vegetariano',
      vegetariana: 'vegetariano',
      vegetarian: 'vegetariano',
      vegano: 'vegano',
      vegana: 'vegano',
      vegan: 'vegano',
      celíaco: 'celiaco',
      celiaco: 'celiaco',
      celiac: 'celiaco',
      sin gluten: 'sin_gluten',
      'sin-gluten': 'sin_gluten',
      gluten: 'sin_gluten',
      alérgico: 'alergico',
      alergico: 'alergico',
      allergic: 'alergico',
      lactosa: 'sin_lactosa',
      'sin lactosa': 'sin_lactosa',
      'sin-lactosa': 'sin_lactosa',
      lactose: 'sin_lactosa',
      kosher: 'kosher',
      halal: 'halal',
      diabético: 'diabetico',
      diabetico: 'diabetico',
      diabetic: 'diabetico',
    };

    return mappings[item] || item.replace(/\s+/g, '_');
  });

  // Remove duplicates
  return [...new Set(normalized)];
}

/**
 * Generate human-readable error report
 */
function generateErrorReport(errors: ImportError[]): string {
  if (errors.length === 0) return '';

  const lines = errors.map(
    (e) => `Línea ${e.line}: Campo "${e.field}" = "${e.value}" — ${e.error}`
  );

  return `Errores encontrados (${errors.length}):\n${lines.join('\n')}`;
}

// ============================================================
// POST: Import CSV
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const auth = await resolveTokenToEventId(token);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Enlace no válido o expirado' },
        { status: 401, headers: securityHeaders() }
      );
    }

    // Check if frozen
    if (await isPortalFrozen(auth.eventId)) {
      return NextResponse.json(
        { success: false, error: 'Portal congelado. No se pueden importar invitados.' },
        { status: 423, headers: securityHeaders() }
      );
    }

    // Get CSV from form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Archivo CSV requerido' },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { success: false, error: 'El archivo debe ser un CSV' },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Read file content
    const content = await file.text();

    // Parse CSV
    const { rows, parseErrors } = parseCsv(content);

    // Limit check (50 rows max)
    if (rows.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: `Máximo 50 filas por importación. El archivo tiene ${rows.length} filas válidas.`,
        },
        { status: 400, headers: securityHeaders() }
      );
    }

    if (rows.length === 0 && parseErrors.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El archivo CSV está vacío o no tiene datos válidos' },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Insert valid rows into database
    const pool = getPool();
    const client = await pool.connect();
    let importedCount = 0;
    const dbErrors: ImportError[] = [];

    try {
      await client.query('BEGIN');

      for (const row of rows) {
        try {
          await client.query(
            `INSERT INTO guests (event_id, name, group_name, rsvp, menu_type, dietary, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              auth.eventId,
              row.name,
              row.group_name,
              row.rsvp,
              row.menu_type,
              JSON.stringify(row.dietary),
              row.notes,
            ]
          );
          importedCount++;
        } catch (dbError: any) {
          dbErrors.push({
            line: row.line,
            field: 'database',
            value: row.name,
            error: dbError.message || 'Error de base de datos',
          });
        }
      }

      await client.query('COMMIT');

      // Emit domain event if any guests were imported
      if (importedCount > 0) {
        try {
          await emitDomainEventStandalone(
            'portal.updated',
            'event',
            auth.eventId,
            {
              section: 'guests',
              summary: `${importedCount} invitados importados desde CSV`,
            }
          );
        } catch (eventError) {
          console.error('[portal-guests-import] Failed to emit domain event:', eventError);
        }
      }

      // Combine parse and DB errors
      const allErrors = [...parseErrors, ...dbErrors];
      const errorReport = generateErrorReport(allErrors);

      const result: ImportResult = {
        success: importedCount > 0,
        total_rows: rows.length + parseErrors.length,
        imported: importedCount,
        errors: allErrors,
        error_report: errorReport,
      };

      return NextResponse.json(result, { headers: securityHeaders() });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[portal-guests-import POST]', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}
