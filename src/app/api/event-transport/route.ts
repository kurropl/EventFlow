/**
 * EventFlow — Event Transport API
 * GET  /api/event-transport?event_id=X — Get transport plan for an event
 * POST /api/event-transport          — Create or update transport plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json({ success: false, error: 'event_id is required' }, { status: 400 });
    }

    const transport = await querySingle<any>(
      `SELECT 
        et.*,
        w.name AS worker_name,
        w.phone AS worker_phone
       FROM event_transport et
       LEFT JOIN workers w ON w.id = et.driver_id
       WHERE et.event_id = $1
       ORDER BY et.created_at DESC
       LIMIT 1`,
      [eventId]
    );

    // Also get the first timing for this event (for auto-calculating arrival)
    const firstTiming = await querySingle<any>(
      `SELECT MIN(planned_time::TIMESTAMPTZ) AS first_timing_time
       FROM event_plans 
       WHERE event_id = $1 
         AND category = 'timing' 
         AND planned_time IS NOT NULL 
         AND planned_time != ''`,
      [eventId]
    );

    return NextResponse.json({ 
      success: true, 
      data: transport || null,
      firstTiming: firstTiming?.first_timing_time || null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.event_id) {
      return NextResponse.json({ success: false, error: 'event_id is required' }, { status: 422 });
    }

    // Check if transport already exists for this event
    const existing = await querySingle<any>(
      'SELECT id FROM event_transport WHERE event_id = $1',
      [body.event_id]
    );

    let transport;

    if (existing) {
      // Update existing transport
      transport = await querySingle<any>(
        `UPDATE event_transport SET
          vehicle_type = COALESCE($1, vehicle_type),
          vehicle_plate = COALESCE($2, vehicle_plate),
          vehicle_description = COALESCE($3, vehicle_description),
          driver_id = $4,
          driver_name = COALESCE($5, driver_name),
          origin_address = COALESCE($6, origin_address),
          destination_address = COALESCE($7, destination_address),
          estimated_trip_minutes = COALESCE($8, estimated_trip_minutes),
          margin_minutes = COALESCE($9, margin_minutes),
          arrival_time = $10,
          status = COALESCE($11, status),
          notes = COALESCE($12, notes),
          updated_at = now()
        WHERE event_id = $13
        RETURNING *`,
        [
          body.vehicle_type,
          body.vehicle_plate,
          body.vehicle_description,
          body.driver_id || null,
          body.driver_name,
          body.origin_address,
          body.destination_address,
          body.estimated_trip_minutes,
          body.margin_minutes,
          body.arrival_time || null,
          body.status,
          body.notes,
          body.event_id
        ]
      );
    } else {
      // Create new transport
      transport = await querySingle<any>(
        `INSERT INTO event_transport (
          event_id, vehicle_type, vehicle_plate, vehicle_description,
          driver_id, driver_name, origin_address, destination_address,
          estimated_trip_minutes, margin_minutes, arrival_time, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          body.event_id,
          body.vehicle_type || 'furgoneta',
          body.vehicle_plate,
          body.vehicle_description,
          body.driver_id || null,
          body.driver_name,
          body.origin_address,
          body.destination_address,
          body.estimated_trip_minutes || 60,
          body.margin_minutes || 30,
          body.arrival_time || null,
          body.status || 'pendiente',
          body.notes
        ]
      );
    }

    return NextResponse.json({ success: true, data: transport }, { status: existing ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
