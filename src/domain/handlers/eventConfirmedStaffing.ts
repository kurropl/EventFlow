/**
 * EventFlow — Handler: Generate staffing requirements when event is confirmed
 * 
 * When an event is confirmed, this handler automatically generates
 * staffing_lines (event_staff_requirements) based on configurable templates.
 * 
 * Template: 1 waiter per 15 guests (configurable in business_settings)
 */

import { getPool } from '@/lib/db';
import type { DomainEvent } from '../events';

// ============================================================
// Configuration
// ============================================================

interface StaffingTemplate {
  role: string;
  ratio: number; // guests per staff member
}

// Default template: 1 waiter per 15 guests
const DEFAULT_TEMPLATE: StaffingTemplate[] = [
  { role: 'camarero', ratio: 15 },
];

// ============================================================
// Get staffing template from business settings
// ============================================================

async function getStaffingTemplate(): Promise<StaffingTemplate[]> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      `SELECT staffing_template FROM business_settings LIMIT 1`
    );
    
    if (result.rows[0]?.staffing_template) {
      return result.rows[0].staffing_template;
    }
  } catch (error) {
    // Column might not exist yet, use default
    console.log('[eventConfirmedStaffing] Using default template (staffing_template column not found)');
  }
  
  return DEFAULT_TEMPLATE;
}

// ============================================================
// Handler
// ============================================================

export async function handleEventConfirmedStaffing(event: DomainEvent): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get event details
    const eventResult = await client.query(
      `SELECT id, guest_count, event_date, venue_type, client_name
       FROM events WHERE id = $1`,
      [event.aggregate_id]
    );
    
    if (eventResult.rows.length === 0) {
      console.error(`[eventConfirmedStaffing] Event not found: ${event.aggregate_id}`);
      await client.query('ROLLBACK');
      return;
    }
    
    const eventData = eventResult.rows[0];
    const guestCount = eventData.guest_count || 0;
    
    if (guestCount === 0) {
      console.log(`[eventConfirmedStaffing] No guests specified for event ${event.aggregate_id}, skipping staffing generation`);
      await client.query('COMMIT');
      return;
    }
    
    // Check if staffing lines already exist for this event (idempotent)
    const existingLines = await client.query(
      `SELECT id FROM staffing_lines WHERE event_id = $1`,
      [event.aggregate_id]
    );
    
    if (existingLines.rows.length > 0) {
      console.log(`[eventConfirmedStaffing] Staffing lines already exist for event ${event.aggregate_id}, skipping`);
      await client.query('COMMIT');
      return;
    }
    
    // Get staffing template
    const template = await getStaffingTemplate();
    
    // Generate staffing lines
    const createdLines: any[] = [];
    
    for (const item of template) {
      const slotsNeeded = Math.ceil(guestCount / item.ratio);
      
      if (slotsNeeded <= 0) continue;
      
      const line = await client.query(
        `INSERT INTO staffing_lines (
          event_id, role, slots_needed, 
          start_time, end_time, location, 
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'open', now(), now())
        RETURNING *`,
        [
          event.aggregate_id,
          item.role,
          slotsNeeded,
          eventData.event_date ? new Date(eventData.event_date) : null,
          null, // end_time will be set later
          eventData.venue_type === 'externo' ? 'Externo' : 'Sala principal'
        ]
      );
      
      createdLines.push(line.rows[0]);
    }
    
    await client.query('COMMIT');
    
    console.log(`[eventConfirmedStaffing] Generated ${createdLines.length} staffing lines for event ${event.aggregate_id} (${guestCount} guests)`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[eventConfirmedStaffing] Error generating staffing requirements:', error);
    throw error;
  } finally {
    client.release();
  }
}
