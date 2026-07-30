/**
 * EventFlow — Helper: Preload hours when event enters in_progress
 * 
 * This function is called when an event transitions to 'in_progress' (day D).
 * It creates worker_hours entries from confirmed staffing assignments.
 * 
 * Can be called from:
 * - Transitions API (OPC-2)
 * - Cron job for events starting today
 * - Manual trigger from admin
 */

import { getPool } from '@/lib/db';
import { emitDomainEventStandalone } from '@/domain/events';

// ============================================================
// Main function
// ============================================================

export async function preloadEventHours(eventId: string): Promise<{
  success: boolean;
  hoursCreated: number;
  error?: string;
}> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if hours already preloaded (idempotent)
    const existingHours = await client.query(
      `SELECT id FROM worker_hours WHERE event_id = $1 LIMIT 1`,
      [eventId]
    );
    
    if (existingHours.rows.length > 0) {
      await client.query('COMMIT');
      return {
        success: true,
        hoursCreated: 0,
        error: 'Hours already preloaded'
      };
    }
    
    // Get all confirmed staffing assignments for this event
    const assignmentsResult = await client.query(
      `SELECT 
        sa.id AS assignment_id,
        sa.worker_id,
        sa.staffing_line_id,
        sl.start_time,
        sl.end_time,
        sl.role,
        w.name AS worker_name
       FROM staffing_assignments sa
       JOIN staffing_lines sl ON sl.id = sa.staffing_line_id
       JOIN workers w ON w.id = sa.worker_id
       WHERE sl.event_id = $1`,
      [eventId]
    );
    
    if (assignmentsResult.rows.length === 0) {
      await client.query('COMMIT');
      return {
        success: true,
        hoursCreated: 0,
        error: 'No confirmed assignments found'
      };
    }
    
    // Calculate and insert hours for each assignment
    let hoursCreated = 0;
    
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
      await client.query(
        `INSERT INTO worker_hours (
          worker_id, event_id, staffing_line_id,
          hours, hour_type, status,
          notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'planificada', 'pendiente', $5, now(), now())`,
        [
          assignment.worker_id,
          eventId,
          assignment.staffing_line_id,
          hours,
          `Turno ${assignment.role} - ${assignment.worker_name} - ${hours}h planificadas`
        ]
      );
      
      hoursCreated++;
      
      // Also update worker_event_pay if it exists
      const existingPay = await client.query(
        `SELECT id, hours FROM worker_event_pay 
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
        // Create new pay record with default rate
        await client.query(
          `INSERT INTO worker_event_pay (
            worker_id, event_id, hours, hourly_rate, total_pay, status
          ) VALUES ($1, $2, $3, 12.00, $4, 'pending')`,
          [
            assignment.worker_id,
            eventId,
            hours,
            hours * 12
          ]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Emit domain event (outside transaction)
    try {
      await emitDomainEventStandalone(
        'hours.preloaded',
        'event',
        eventId,
        {
          event_id: eventId,
          hours_created: hoursCreated
        }
      );
    } catch (eventError) {
      console.error('[preloadEventHours] Failed to emit domain event:', eventError);
      // Don't fail the request if event emission fails
    }
    
    return {
      success: true,
      hoursCreated
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[preloadEventHours] Error:', error);
    return {
      success: false,
      hoursCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    client.release();
  }
}
