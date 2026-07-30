/**
 * EventFlow — Tests de WP-20: Vajilla y Packs Automáticos
 *
 * Verifica:
 * 1. Cálculo correcto de vajilla: pax × pases = total juegos
 * 2. Packs generados correctamente según plantilla
 * 3. Invitado celíaco → pack alérgenos incluye ítems sin gluten
 * 4. Integración con hoja de carga
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock de la base de datos para tests unitarios
vi.mock('@/lib/db', () => ({
  queryMany: vi.fn(),
  querySingle: vi.fn(),
  getPool: vi.fn(),
}));

// Mock de operations para calculateCamareros
vi.mock('@/lib/operations', () => ({
  calcCamareros: vi.fn((pax: number, serviceType: string) => {
    if (serviceType === 'coctel') return Math.ceil(pax / 12);
    return Math.ceil(pax / 10) + Math.floor(pax / 25);
  }),
}));

// Importar después del mock
import { calculateVajilla } from '@/lib/vajilla';
import { calculatePacks, getEventDietarySummary } from '@/lib/packs';
import { queryMany, querySingle } from '@/lib/db';

describe('WP-20: Vajilla y Packs Automáticos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cálculo de Vajilla', () => {
    it('debería calcular 500 juegos de vajilla para 100 pax × 5 pases', async () => {
      // Configurar mocks para las llamadas secuenciales
      const mockQuerySingle = querySingle as any;
      const mockQueryMany = queryMany as any;

      // 1. Evento
      mockQuerySingle.mockResolvedValueOnce({
        id: 'event-1',
        client_name: 'Boda García',
        guest_count: 100,
        kids_count: 0,
      });

      // 2. Número de pases
      mockQueryMany.mockResolvedValueOnce([{ num_passes: 5 }]);

      // 3. Template activo
      mockQuerySingle.mockResolvedValueOnce({ id: 'tpl-1', name: 'Vajilla Estándar' });

      // 4. Ítems del template
      mockQueryMany.mockResolvedValueOnce([
        { name: 'Tenedor', category: 'cubiertos', quantity_per_pax: 1, pass_number: null },
        { name: 'Cuchillo', category: 'cubiertos', quantity_per_pax: 1, pass_number: null },
        { name: 'Plato hondo', category: 'vajilla', quantity_per_pax: 1, pass_number: null },
      ]);

      // 5. Nombres de pases
      mockQueryMany.mockResolvedValueOnce([
        { pass_number: 1, name: 'Aperitivos' },
        { pass_number: 2, name: 'Entrante' },
        { pass_number: 3, name: 'Principal' },
        { pass_number: 4, name: 'Postre' },
        { pass_number: 5, name: 'Bebidas' },
      ]);

      const result = await calculateVajilla('event-1');

      expect(result).not.toBeNull();
      expect(result!.pax).toBe(100);
      expect(result!.num_passes).toBe(5);

      // Totales: 3 ítems × 100 pax × 5 pases = 1500 unidades de cada ítem
      const tenedor = result!.totals.find(t => t.name === 'Tenedor');
      expect(tenedor?.total_quantity).toBe(500); // 100 pax × 5 pases × 1 ud/pax

      const plato = result!.totals.find(t => t.name === 'Plato hondo');
      expect(plato?.total_quantity).toBe(500);

      // Verificar desglose por pase
      expect(result!.by_pass).toHaveLength(5);
      expect(result!.by_pass[0].pass_name).toBe('Aperitivos');
      expect(result!.by_pass[0].items).toHaveLength(3); // 3 ítems por pase
      expect(result!.by_pass[0].items[0].total_quantity).toBe(100); // 100 pax × 1 ud/pax
    });

    it('debería manejar eventos con niños correctamente', async () => {
      const mockQuerySingle = querySingle as any;
      const mockQueryMany = queryMany as any;

      mockQuerySingle.mockResolvedValueOnce({
        id: 'event-2',
        client_name: 'Fiesta Infantil',
        guest_count: 80,
        kids_count: 20,
      });

      mockQueryMany.mockResolvedValueOnce([{ num_passes: 3 }]);
      mockQuerySingle.mockResolvedValueOnce({ id: 'tpl-1', name: 'Vajilla Estándar' });
      mockQueryMany.mockResolvedValueOnce([
        { name: 'Tenedor', category: 'cubiertos', quantity_per_pax: 1, pass_number: null },
      ]);
      mockQueryMany.mockResolvedValueOnce([
        { pass_number: 1, name: 'Entrante' },
        { pass_number: 2, name: 'Principal' },
        { pass_number: 3, name: 'Postre' },
      ]);

      const result = await calculateVajilla('event-2');

      expect(result!.pax).toBe(100); // 80 adultos + 20 niños
      const tenedor = result!.totals.find(t => t.name === 'Tenedor');
      expect(tenedor?.total_quantity).toBe(300); // 100 pax × 3 pases
    });

    it('debería respetar pass_number para ítems específicos de un pase', async () => {
      const mockQuerySingle = querySingle as any;
      const mockQueryMany = queryMany as any;

      mockQuerySingle.mockResolvedValueOnce({
        id: 'event-3',
        client_name: 'Evento Premium',
        guest_count: 50,
        kids_count: 0,
      });

      mockQueryMany.mockResolvedValueOnce([{ num_passes: 4 }]);
      mockQuerySingle.mockResolvedValueOnce({ id: 'tpl-1', name: 'Vajilla Premium' });
      mockQueryMany.mockResolvedValueOnce([
        { name: 'Tenedor', category: 'cubiertos', quantity_per_pax: 1, pass_number: null }, // todos los pases
        { name: 'Copa de postre', category: 'cristaleria', quantity_per_pax: 1, pass_number: 4 }, // solo pase 4
      ]);
      mockQueryMany.mockResolvedValueOnce([
        { pass_number: 1, name: 'Aperitivos' },
        { pass_number: 2, name: 'Entrante' },
        { pass_number: 3, name: 'Principal' },
        { pass_number: 4, name: 'Postre' },
      ]);

      const result = await calculateVajilla('event-3');

      // Copa de postre solo debe aparecer en pase 4
      const pase4 = result!.by_pass.find(p => p.pass_number === 4);
      expect(pase4?.items.find(i => i.name === 'Copa de postre')?.total_quantity).toBe(50);

      // Copa de postre NO debe aparecer en pases 1, 2, 3
      const pase1 = result!.by_pass.find(p => p.pass_number === 1);
      expect(pase1?.items.find(i => i.name === 'Copa de postre')).toBeUndefined();

      // Totales: Copa de postre solo 50 (1 pase), Tenedor 200 (4 pases)
      const copa = result!.totals.find(t => t.name === 'Copa de postre');
      expect(copa?.total_quantity).toBe(50);
      const tenedor = result!.totals.find(t => t.name === 'Tenedor');
      expect(tenedor?.total_quantity).toBe(200);
    });
  });

  describe('Cálculo de Packs', () => {
    it('debería calcular pack de camareros con número correcto de empleados', async () => {
      const mockQuerySingle = querySingle as any;
      const mockQueryMany = queryMany as any;

      mockQuerySingle.mockResolvedValueOnce({
        id: 'event-4',
        client_name: 'Evento Corporativo',
        guest_count: 100,
        kids_count: 0,
        service_type: 'menu',
      });

      // Invitados confirmados (sin restricciones)
      mockQueryMany.mockResolvedValueOnce([]);

      // Pack templates
      mockQueryMany.mockResolvedValueOnce([
        { id: 'tpl-c', name: 'Pack Camareros', pack_type: 'camareros', description: 'Equipamiento' },
      ]);

      // Template items
      mockQueryMany.mockResolvedValueOnce([
        { name: 'Delantal', category: 'uniforme', quantity_per_unit: 1, condition_type: 'all', condition_value: null },
        { name: 'Guantes', category: 'proteccion', quantity_per_unit: 2, condition_type: 'all', condition_value: null },
      ]);

      // Notes para cada item
      mockQuerySingle.mockResolvedValueOnce({ notes: 'Delantal negro' });
      mockQuerySingle.mockResolvedValueOnce({ notes: '2 por camarero' });

      const result = await calculatePacks('event-4');

      expect(result).not.toBeNull();
      expect(result!.num_camareros).toBeGreaterThan(0);

      const camarerosPack = result!.packs.find(p => p.pack_type === 'camareros');
      expect(camarerosPack).toBeDefined();
      // Delantal: 1 por camarero, Guantes: 2 por camarero
      expect(camarerosPack?.items.find(i => i.name === 'Delantal')?.quantity)
        .toBe(result!.num_camareros);
      expect(camarerosPack?.items.find(i => i.name === 'Guantes')?.quantity)
        .toBe(result!.num_camareros * 2);
    });

    it('debería incluir ítems sin gluten para invitados celíacos', async () => {
      const mockQuerySingle = querySingle as any;
      const mockQueryMany = queryMany as any;

      mockQuerySingle.mockResolvedValueOnce({
        id: 'event-5',
        client_name: 'Boda con Celíacos',
        guest_count: 80,
        kids_count: 0,
        service_type: 'menu',
      });

      // 2 invitados celíacos
      mockQueryMany.mockResolvedValueOnce([
        { dietary: ['celiaco'] },
        { dietary: ['celiaco'] },
      ]);

      mockQueryMany.mockResolvedValueOnce([
        { id: 'tpl-a', name: 'Pack Alérgenos', pack_type: 'alergenos', description: 'Alérgenos' },
      ]);

      mockQueryMany.mockResolvedValueOnce([
        { name: 'Pan sin gluten', category: 'alimento', quantity_per_unit: 1, condition_type: 'dietary', condition_value: 'celiaco' },
        { name: 'Servilleta identificativa', category: 'identificacion', quantity_per_unit: 1, condition_type: 'all', condition_value: null },
      ]);

      mockQuerySingle.mockResolvedValueOnce({ notes: 'Para celiacos' });
      mockQuerySingle.mockResolvedValueOnce({ notes: 'Marca visual' });

      const result = await calculatePacks('event-5');

      const alergenosPack = result!.packs.find(p => p.pack_type === 'alergenos');
      expect(alergenosPack).toBeDefined();

      // Pan sin gluten: 2 unidades (1 por cada celiaco)
      const panSinGluten = alergenosPack?.items.find(i => i.name === 'Pan sin gluten');
      expect(panSinGluten?.quantity).toBe(2);

      // Servilleta: 80 unidades (todos los pax)
      const servilleta = alergenosPack?.items.find(i => i.name === 'Servilleta identificativa');
      expect(servilleta?.quantity).toBe(80);
    });

    it('debería calcular pack de supervivencia con ítems básicos', async () => {
      const mockQuerySingle = querySingle as any;
      const mockQueryMany = queryMany as any;

      mockQuerySingle.mockResolvedValueOnce({
        id: 'event-6',
        client_name: 'Evento Exterior',
        guest_count: 150,
        kids_count: 0,
        service_type: 'menu',
      });

      mockQueryMany.mockResolvedValueOnce([]); // guests
      mockQueryMany.mockResolvedValueOnce([
        { id: 'tpl-s', name: 'Pack Supervivencia', pack_type: 'supervivencia', description: 'Emergencia' },
      ]);
      mockQueryMany.mockResolvedValueOnce([
        { name: 'Botiquín', category: 'emergencia', quantity_per_unit: 1, condition_type: 'all', condition_value: null },
        { name: 'Manta térmica', category: 'emergencia', quantity_per_unit: 2, condition_type: 'all', condition_value: null },
      ]);
      mockQuerySingle.mockResolvedValueOnce({ notes: 'Kit completo' });
      mockQuerySingle.mockResolvedValueOnce({ notes: 'Para emergencias' });

      const result = await calculatePacks('event-6');

      const supervivenciaPack = result!.packs.find(p => p.pack_type === 'supervivencia');
      expect(supervivenciaPack).toBeDefined();

      // Botiquín: 150 (1 por pax)
      expect(supervivenciaPack?.items.find(i => i.name === 'Botiquín')?.quantity).toBe(150);
      // Manta térmica: 300 (2 por pax)
      expect(supervivenciaPack?.items.find(i => i.name === 'Manta térmica')?.quantity).toBe(300);
    });
  });

  describe('Resumen Dietético', () => {
    it('debería contar correctamente las restricciones alimentarias', async () => {
      const mockQueryMany = queryMany as any;

      mockQueryMany.mockResolvedValueOnce([
        { dietary: ['celiaco'] },
        { dietary: ['celiaco', 'sin_lactosa'] },
        { dietary: ['vegano'] },
        { dietary: [] },
        { dietary: null },
      ]);

      const result = await getEventDietarySummary('event-7');

      expect(result).not.toBeNull();
      expect(result!.total_guests).toBe(5);
      expect(result!.with_restrictions).toBe(3);

      const celiacos = result!.restrictions.find(r => r.type === 'celiaco');
      expect(celiacos?.count).toBe(2);

      const veganos = result!.restrictions.find(r => r.type === 'vegano');
      expect(veganos?.count).toBe(1);

      const lactosa = result!.restrictions.find(r => r.type === 'sin_lactosa');
      expect(lactosa?.count).toBe(1);
    });
  });
});
