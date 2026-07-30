/**
 * EventFlow — Handler: Preload hours when event enters in_progress
 * 
 * When an event transitions to 'in_progress' (day D), confirmed shifts
 * automatically create worker_hours entries for time tracking.
 * 
 * This integrates with the existing worker_event_pay system.
 */

import { getPool } from '@/lib/db';
import type { DomainEvent } from '../events';

// ============================================================
// Handler
// ============================================================

export async function handleShiftConfirmedPreloadHours(event: DomainEvent): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const eventId = event.aggregate_id;
    
    // Get all confirmed staffing assignments for this event
    const assignmentsResult = await client.query(
      `SELECT 
        sa.id AS assignment_id,
        sa.worker_id,
        sa.staffing_line_id,
        sl.start_time,
        sl.end_time,
        sl.role
       FROM staffing_assignments sa
       JOIN staffing_lines sl ON sl.id = sa.staffing_line_id
       WHERE sl.event_id = $1`,
      [eventId]
    );
    
    if (assignmentsResult.rows.length === 0) {
      console.log(`[shiftConfirmedPreloadHours] No confirmed assignments for event ${eventId}`);
      await client.query('COMMIT');
      return;
    }
    
    // Check if hours already preloaded for this event (idempotent)
    const existingHours = await client.query(
      `SELECT id FROM worker_hours WHERE event_id = $1`,
      [eventId]
    );
    
    if (existingHours.rows.length > 0) {
      console.log(`[shiftConfirmedPreloadHours] Hours already preloaded for event ${eventId}`);
      await client.query('COMMIT');
      return;
    }
    
    // Calculate and insert hours for each assignment
    const createdHours: any[] = [];
    
    for (const assignment of assignmentsResult.rows) {
      let hours = 0;
      
      // Calculate hours from start_time and end_time if available
      if (assignment.start_time && assignment.end_time) {
        const start = new Date(assignment.start_time);
        const end = new Date(assignment.end_time);
        hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 100) / 100;
      } else {
        // Default to 8 hours if times not specified
        hours = 8;
      }
      
      // Create worker_hours entry
      const hourEntry = await client.query(
        `INSERT INTO worker_hours (
          worker_id, event_id, staffing_line_id,
          hours, hour_type, status,
          notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'planificada', 'pendiente', $5, now(), now())
        RETURNING *`,
        [
          assignment.worker_id,
          eventId,
          assignment.staffing_line_id,
          hours,
          `Turno ${assignment.role} - ${hours}h planificadas`
        ]
      );
      
      createdHours.push(hourEntry.rows[0]);
      
      // Also update worker_event_pay if it exists for this worker+event
      const existingPay = await client.query(
        `SELECT id FROM worker_event_pay 
         WHERE worker_id = $1 AND event_id = $2`,
        [assignment.worker_id, eventId]
      );
      
      if (existingPay.rows.length > 0) {
        // Update existing pay record
        await client.query(
          `UPDATE worker_event_pay 
           SET hours = hours + $1, updated_at = now()
           WHERE worker_id = $2 AND event_id = $3`,
          [hours, assignment.worker_id, eventId]
        );
      } else {
        // Create new pay record
        // Get hourly rate from worker or default
        const workerResult = await client.query(
          `SELECT hourly_rate FROM workers WHERE id = $1`,
          [assignment.worker_id]
        );
        
        const hourlyRate = workerResult.rows[0]?.hourly_rate || 12; // Default rate
        
        await client.query(
          `INSERT INTO worker_event_pay (
            worker_id, event_id, hours, hourly_rate, total_pay, status
          ) VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [
            assignment.worker_id,
            eventId,
            hours,
            hourlyRate,
            hours * hourlyRate
          ]
        );
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`[shiftConfirmedPreloadHours] Preloaded ${createdHours.length} hour entries for event ${eventId}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[shiftConfirmedPreloadHours] Error preloading hours:', error);
    throw error;
  } finally {
    client.release();
  }
}
