/**
 * POST /api/floor-plan/generate
 * Generates table distribution from budget data (guest_count, kids_count, etc.)
 * Returns JSON array of table positions.
 */
import { NextResponse } from 'next/server';

interface Waiter {
  id: string;
  name: string;
  role: string;
}

interface TablePos {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
  shape: 'round' | 'rect' | 'long';
  color: string;
  waiter: string;
}

const TABLE_COLORS = [
  '#C9A84C', '#4682B4', '#6B8E23', '#9370DB', '#CD5C5C',
  '#20B2AA', '#A88A3A', '#D4A574', '#B8860B', '#D2691E',
  '#8B7355', '#7B68EE', '#2E8B57', '#B22222', '#F4A460',
];

function snap(val: number, grid: number): number {
  return Math.round(val / grid) * grid;
}

function generateDistribution(
  guestCount: number,
  tablesSuggested: number,
  kidsCount: number,
  waiters: Waiter[]
): TablePos[] {
  const tables: TablePos[] = [];
  const adultGuests = guestCount - kidsCount;
  const totalTables = Math.max(tablesSuggested, Math.ceil(guestCount / 8));

  // 1. Main table for the hosts (near stage area)
  const mainCapacity = Math.min(12, Math.max(8, Math.ceil(adultGuests * 0.12)));
  const mainType: 'rect' | 'long' = mainCapacity <= 10 ? 'rect' : 'long';
  tables.push({
    id: 't1',
    name: 'Mesa Principal',
    x: snap(350, 10),
    y: snap(60, 10),
    width: mainType === 'rect' ? 100 : 140,
    height: 60,
    rotation: 0,
    capacity: mainCapacity,
    shape: mainType,
    color: '#C9A84C',
    waiter: waiters.length > 0 ? waiters[0].name : '',
  });

  const remainingGuests = adultGuests - mainCapacity;
  const roundTablesNeeded = Math.max(1, Math.ceil(remainingGuests / 8));
  const kidsTableCount = kidsCount > 0 ? Math.max(1, Math.ceil(kidsCount / 8)) : 0;

  // Distribute adult round tables in a horseshoe pattern
  const radiusX = 260;
  const radiusY = 180;
  const centerX = 400;
  const centerY = 330;
  const gap = Math.PI / (Math.max(roundTablesNeeded + kidsTableCount, 3));

  for (let i = 0; i < roundTablesNeeded; i++) {
    const angle = gap * (i + 1) + Math.PI * 0.1;
    const x = snap(centerX + radiusX * Math.cos(angle), 10);
    const y = snap(centerY + radiusY * Math.sin(angle), 10);
    const waiterIdx = ((i + 1) % Math.max(waiters.length, 1));
    const waiter = waiters.length > 0 ? waiters[waiterIdx % waiters.length].name : '';

    tables.push({
      id: `t${i + 2}`,
      name: `Mesa ${i + 1}`,
      x, y,
      width: 60, height: 60,
      rotation: 0,
      capacity: 8,
      shape: 'round',
      color: TABLE_COLORS[(i + 1) % TABLE_COLORS.length],
      waiter,
    });
  }

  // Kids tables (long, right side)
  for (let i = 0; i < kidsTableCount; i++) {
    const idx = roundTablesNeeded + i;
    tables.push({
      id: `t${idx + 2}`,
      name: `Mesa Infantil ${i + 1}`,
      x: snap(620 + (i % 2) * 80, 10),
      y: snap(200 + Math.floor(i / 2) * 100, 10),
      width: 80, height: 40,
      rotation: 0,
      capacity: 8,
      shape: 'long',
      color: '#D4A574',
      waiter: waiters.length > 0 ? waiters[idx % waiters.length].name : '',
    });
  }

  return tables;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { guestCount, tablesSuggested, kidsCount, waiters } = body;

    if (!guestCount || guestCount < 1) {
      return NextResponse.json({
        success: false,
        error: 'guestCount is required',
      }, { status: 400 });
    }

    const suggested = tablesSuggested || Math.ceil(guestCount / 8);
    const distribution = generateDistribution(
      guestCount,
      suggested,
      kidsCount || 0,
      (waiters as Waiter[]) || []
    );

    return NextResponse.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    }, { status: 500 });
  }
}
