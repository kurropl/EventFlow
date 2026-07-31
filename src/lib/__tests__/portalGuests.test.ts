/**
 * WP-26: Portal — Invitados y RSVP
 * Tests unitarios para la lógica del portal de invitados.
 *
 * Ejecutar: npx vitest run src/lib/__tests__/portalGuests.test.ts
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// Funciones de validación extraídas para test
// ============================================================

/** Normalize RSVP value */
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
    'no_asistirá': 'rechazado',
    'no asistira': 'rechazado',
  };

  return mappings[lower] || 'pendiente';
}

/** Validate RSVP value */
function validateRsvp(value: string): string | null {
  if (!['pendiente', 'confirmado', 'rechazado'].includes(value)) {
    return `RSVP inválido "${value}"`;
  }
  return null;
}

/** Normalize menu type */
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

/** Validate menu type */
function validateMenuType(value: string): string | null {
  if (!['adulto', 'nino', 'bebe'].includes(value)) {
    return `Tipo de menú inválido "${value}"`;
  }
  return null;
}

/** Parse dietary field */
function parseDietary(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];

  const items = value
    .split(/[,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);

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
      'sin gluten': 'sin_gluten',
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

  return [...new Set(normalized)];
}

/** Validate guest input */
function validateGuestInput(input: {
  name?: string;
  group_name?: string | null;
  rsvp?: string;
  menu_type?: string;
  notes?: string | null;
}): string | null {
  if (!input.name || input.name.trim().length === 0) {
    return 'El nombre del invitado es obligatorio';
  }
  if (input.name.length > 200) {
    return 'El nombre no puede exceder 200 caracteres';
  }
  if (input.rsvp && !['pendiente', 'confirmado', 'rechazado'].includes(input.rsvp)) {
    return 'RSVP inválido';
  }
  if (input.menu_type && !['adulto', 'nino', 'bebe'].includes(input.menu_type)) {
    return 'Tipo de menú inválido';
  }
  if (input.group_name && input.group_name.length > 100) {
    return 'El nombre del grupo no puede exceder 100 caracteres';
  }
  if (input.notes && input.notes.length > 1000) {
    return 'Las notas no pueden exceder 1000 caracteres';
  }
  return null;
}

/** Parse CSV line */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
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

/** Check if portal is frozen */
function isPortalFrozen(
  portalStatus: string,
  freezeDate: string | null
): boolean {
  if (portalStatus === 'congelado' || portalStatus === 'cerrado') return true;
  if (freezeDate && new Date(freezeDate) <= new Date()) return true;
  return false;
}

// ============================================================
// Tests: RSVP Normalization
// ============================================================

describe('WP-26: RSVP Normalization', () => {
  it('should normalize short codes', () => {
    expect(normalizeRsvp('p')).toBe('pendiente');
    expect(normalizeRsvp('c')).toBe('confirmado');
    expect(normalizeRsvp('r')).toBe('rechazado');
  });

  it('should normalize Spanish values', () => {
    expect(normalizeRsvp('pendiente')).toBe('pendiente');
    expect(normalizeRsvp('confirmado')).toBe('confirmado');
    expect(normalizeRsvp('rechazado')).toBe('rechazado');
  });

  it('should normalize English values', () => {
    expect(normalizeRsvp('pending')).toBe('pendiente');
    expect(normalizeRsvp('confirm')).toBe('confirmado');
    expect(normalizeRsvp('declined')).toBe('rechazado');
  });

  it('should normalize yes/no values', () => {
    expect(normalizeRsvp('yes')).toBe('confirmado');
    expect(normalizeRsvp('sí')).toBe('confirmado');
    expect(normalizeRsvp('si')).toBe('confirmado');
    expect(normalizeRsvp('no')).toBe('pendiente');
  });

  it('should default to pendiente for unknown values', () => {
    expect(normalizeRsvp('')).toBe('pendiente');
    expect(normalizeRsvp(undefined)).toBe('pendiente');
    expect(normalizeRsvp('unknown')).toBe('pendiente');
  });

  it('should validate RSVP values', () => {
    expect(validateRsvp('pendiente')).toBeNull();
    expect(validateRsvp('confirmado')).toBeNull();
    expect(validateRsvp('rechazado')).toBeNull();
    expect(validateRsvp('invalid')).not.toBeNull();
  });
});

// ============================================================
// Tests: Menu Type Normalization
// ============================================================

describe('WP-26: Menu Type Normalization', () => {
  it('should normalize short codes', () => {
    expect(normalizeMenuType('a')).toBe('adulto');
    expect(normalizeMenuType('n')).toBe('nino');
    expect(normalizeMenuType('b')).toBe('bebe');
  });

  it('should normalize Spanish values', () => {
    expect(normalizeMenuType('adulto')).toBe('adulto');
    expect(normalizeMenuType('niño')).toBe('nino');
    expect(normalizeMenuType('nino')).toBe('nino');
    expect(normalizeMenuType('bebé')).toBe('bebe');
    expect(normalizeMenuType('bebe')).toBe('bebe');
  });

  it('should normalize English values', () => {
    expect(normalizeMenuType('adult')).toBe('adulto');
    expect(normalizeMenuType('kid')).toBe('nino');
    expect(normalizeMenuType('child')).toBe('nino');
    expect(normalizeMenuType('baby')).toBe('bebe');
  });

  it('should default to adulto for unknown values', () => {
    expect(normalizeMenuType('')).toBe('adulto');
    expect(normalizeMenuType(undefined)).toBe('adulto');
    expect(normalizeMenuType('unknown')).toBe('adulto');
  });

  it('should validate menu type values', () => {
    expect(validateMenuType('adulto')).toBeNull();
    expect(validateMenuType('nino')).toBeNull();
    expect(validateMenuType('bebe')).toBeNull();
    expect(validateMenuType('invalid')).not.toBeNull();
  });
});

// ============================================================
// Tests: Dietary Parsing
// ============================================================

describe('WP-26: Dietary Parsing', () => {
  it('should parse comma-separated values', () => {
    expect(parseDietary('vegetariano, celiaco')).toEqual(['vegetariano', 'celiaco']);
  });

  it('should parse semicolon-separated values', () => {
    expect(parseDietary('vegano; sin lactosa')).toEqual(['vegano', 'sin_lactosa']);
  });

  it('should normalize dietary terms', () => {
    expect(parseDietary('Vegetariana')).toEqual(['vegetariano']);
    expect(parseDietary('Vegana')).toEqual(['vegano']);
    expect(parseDietary('Celíaco')).toEqual(['celiaco']);
    expect(parseDietary('Sin Gluten')).toEqual(['sin_gluten']);
    expect(parseDietary('Kosher')).toEqual(['kosher']);
    expect(parseDietary('Halal')).toEqual(['halal']);
  });

  it('should remove duplicates', () => {
    expect(parseDietary('vegetariano, vegetariana')).toEqual(['vegetariano']);
    expect(parseDietary('vegano, vegan')).toEqual(['vegano']);
  });

  it('should handle empty input', () => {
    expect(parseDietary('')).toEqual([]);
    expect(parseDietary(undefined)).toEqual([]);
    expect(parseDietary('   ')).toEqual([]);
  });

  it('should handle mixed separators', () => {
    expect(parseDietary('vegetariano, celiaco; sin lactosa')).toEqual([
      'vegetariano',
      'celiaco',
      'sin_lactosa',
    ]);
  });
});

// ============================================================
// Tests: Guest Input Validation
// ============================================================

describe('WP-26: Guest Input Validation', () => {
  it('should require name', () => {
    expect(validateGuestInput({ name: '' })).not.toBeNull();
    expect(validateGuestInput({ name: '   ' })).not.toBeNull();
    expect(validateGuestInput({})).not.toBeNull();
  });

  it('should accept valid input', () => {
    expect(validateGuestInput({ name: 'Juan García' })).toBeNull();
  });

  it('should validate name length', () => {
    expect(validateGuestInput({ name: 'a'.repeat(200) })).toBeNull();
    expect(validateGuestInput({ name: 'a'.repeat(201) })).not.toBeNull();
  });

  it('should validate group name length', () => {
    expect(validateGuestInput({ name: 'Test', group_name: 'a'.repeat(100) })).toBeNull();
    expect(validateGuestInput({ name: 'Test', group_name: 'a'.repeat(101) })).not.toBeNull();
  });

  it('should validate notes length', () => {
    expect(validateGuestInput({ name: 'Test', notes: 'a'.repeat(1000) })).toBeNull();
    expect(validateGuestInput({ name: 'Test', notes: 'a'.repeat(1001) })).not.toBeNull();
  });

  it('should validate RSVP value', () => {
    expect(validateGuestInput({ name: 'Test', rsvp: 'pendiente' })).toBeNull();
    expect(validateGuestInput({ name: 'Test', rsvp: 'invalid' })).not.toBeNull();
  });

  it('should validate menu_type value', () => {
    expect(validateGuestInput({ name: 'Test', menu_type: 'adulto' })).toBeNull();
    expect(validateGuestInput({ name: 'Test', menu_type: 'invalid' })).not.toBeNull();
  });
});

// ============================================================
// Tests: CSV Parsing
// ============================================================

describe('WP-26: CSV Parsing', () => {
  it('should parse simple CSV line', () => {
    expect(parseCsvLine('Juan García,Familia,c,adulto,,')).toEqual([
      'Juan García',
      'Familia',
      'c',
      'adulto',
      '',
      '',
    ]);
  });

  it('should handle quoted fields', () => {
    expect(parseCsvLine('"Juan García","Familia Real",c,adulto,,"Notas con, coma"')).toEqual([
      'Juan García',
      'Familia Real',
      'c',
      'adulto',
      '',
      'Notas con, coma',
    ]);
  });

  it('should handle escaped quotes', () => {
    expect(parseCsvLine('"Nombre ""con comillas""",Grupo')).toEqual([
      'Nombre "con comillas"',
      'Grupo',
    ]);
  });
});

// ============================================================
// Tests: Portal Frozen State
// ============================================================

describe('WP-26: Portal Frozen State', () => {
  it('should detect frozen portal by status', () => {
    expect(isPortalFrozen('congelado', null)).toBe(true);
    expect(isPortalFrozen('cerrado', null)).toBe(true);
    expect(isPortalFrozen('activo', null)).toBe(false);
  });

  it('should detect frozen portal by freeze date', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow

    expect(isPortalFrozen('activo', pastDate)).toBe(true);
    expect(isPortalFrozen('activo', futureDate)).toBe(false);
  });

  it('should prioritize status over freeze date', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    expect(isPortalFrozen('congelado', futureDate)).toBe(true);
  });
});
