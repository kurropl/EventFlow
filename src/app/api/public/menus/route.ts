/**
 * EventFlow — Public Menus API
 * GET /api/public/menus — List published menus for the configurador
 *
 * Returns only menus with status = 'publicado'.
 * Requires no authentication (public endpoint).
 * Maps menu IDs to the string format expected by the configurador.
 */

import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

interface PublicMenu {
  id: string;           // String ID for configurador compatibility ('menu1', 'menu2'...)
  db_id: number;        // Numeric DB ID from menus table
  name: string;
  tag: string;
  is_kid: boolean;
  price_per_pax: number;
  description: string | null;
  sections: { section: string; items: string[] }[];
}

/**
 * Map DB menu name → configurador string ID
 * Used for backward compatibility with the wizard store
 */
function menuNameToConfigId(name: string): string {
  const n = name.toLowerCase().trim();
  if (n.includes('niño 1') || n.includes('nino 1')) return 'kid1';
  if (n.includes('niño 2') || n.includes('nino 2')) return 'kid2';
  if (n.includes('cóctel 1') || n.includes('coctel 1')) return 'cocktail1';
  if (n.includes('cóctel 2') || n.includes('coctel 2')) return 'cocktail2';
  // Adult menus: "Menú 1" → "menu1", etc.
  const match = n.match(/menú\s*(\d+)/);
  if (match) return `menu${match[1]}`;
  // Fallback: slugify
  return n.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
}

/**
 * Determine if a menu is a kids menu
 */
function isKidMenu(name: string): boolean {
  return name.toLowerCase().includes('niño') || name.toLowerCase().includes('nino');
}

/**
 * Get tag from menu name (matches existing proposed_menus tags)
 */
function getMenuTag(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('niño 2') || n.includes('nino 2')) return 'Infantil +';
  if (n.includes('niño') || n.includes('nino')) return 'Infantil';
  if (n.includes('cóctel 2') || n.includes('coctel 2')) return 'Premium';
  if (n.includes('cóctel') || n.includes('coctel')) return 'Canapés';
  if (n.includes('6')) return 'Gran Selección';
  if (n.includes('5')) return 'Premium +';
  if (n.includes('4')) return 'Premium';
  if (n.includes('3')) return 'Completo';
  if (n.includes('2')) return 'Recomendado';
  return 'Esencial';
}

/**
 * Load sections and dishes for a menu from menu_sections + menu_section_dishes
 */
async function loadMenuSections(menuId: number): Promise<{ section: string; items: string[] }[]> {
  try {
    const sections = await queryMany<{ id: number; name: string; position: number }>(
      `SELECT id, name, position FROM menu_sections WHERE menu_id = $1 ORDER BY position`,
      [menuId]
    );

    if (sections.length === 0) return [];

    const sectionIds = sections.map(s => s.id);
    const dishes = await queryMany<{ section_id: number; dish_name: string }>(
      `SELECT section_id, dish_name FROM menu_section_dishes WHERE section_id = ANY($1)`,
      [sectionIds]
    );

    return sections.map(s => ({
      section: s.name,
      items: dishes
        .filter(d => d.section_id === s.id)
        .map(d => d.dish_name)
        .filter(Boolean),
    }));
  } catch {
    // menu_sections may not exist yet (WP-12 not done)
    return [];
  }
}

export async function GET() {
  try {
    // Try to read from the menus table first
    let menus: any[] = [];
    try {
      menus = await queryMany<any>(
        `SELECT id, name, version, status, price_per_pax, description
         FROM menus
         WHERE status = 'publicado'
         ORDER BY name ASC`,
        []
      );
    } catch {
      // menus table may not exist yet (WP-12 pending)
      // Fall back to empty — the configurador will use hardcoded menus
      return NextResponse.json({
        success: true,
        data: [],
        source: 'hardcoded',  // Signal to frontend to use local data
        message: 'Tabla menus no disponible, usando menús locales',
      });
    }

    if (menus.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        source: 'empty',
        message: 'No hay menús publicados',
      });
    }

    // Build public menu objects with sections
    const publicMenus: PublicMenu[] = await Promise.all(
      menus.map(async (menu) => {
        const sections = await loadMenuSections(menu.id);

        // If no sections loaded from DB, provide empty sections
        // (the configurador will still show the menu with price)
        const menuSections = sections.length > 0
          ? sections
          : [{ section: 'Consulte los platos disponibles', items: [] }];

        return {
          id: menuNameToConfigId(menu.name),
          db_id: menu.id,
          name: menu.name,
          tag: getMenuTag(menu.name),
          is_kid: isKidMenu(menu.name),
          price_per_pax: Number(menu.price_per_pax),
          description: menu.description,
          sections: menuSections,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: publicMenus,
      source: 'database',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
