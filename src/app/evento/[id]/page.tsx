/**
 * EventFlow — Public Event View Page
 * /evento/[id] — Public page for clients to view their budget
 *
 * No auth required. Access by unique event UUID.
 * Shows: event details, selected menu, items breakdown, totals.
 * No prices shown (B2C rule).
 */

import { querySingle } from '@/lib/db';
import { notFound } from 'next/navigation';
import ClientEventView from './ClientEventView';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventoPage({ params }: PageProps) {
  const { id } = await params;

  const event = await querySingle<any>(
    `SELECT id, menu_id, client_name, event_type, guest_count, kids_count,
            event_date, status, selected_items, notes, created_at
     FROM events WHERE id = $1`,
    [id]
  );

  if (!event) {
    notFound();
  }

  // Get menu name if set
  let menuName = 'Personalizado';
  if (event.menu_id) {
    const menu = await querySingle<any>(
      `SELECT name, tag FROM proposed_menus WHERE id = $1`,
      [event.menu_id]
    );
    if (menu) {
      menuName = `${menu.name} (${menu.tag})`;
    }
  }

  const items = event.selected_items || [];

  return (
    <ClientEventView
      clientName={event.client_name}
      eventType={event.event_type}
      eventDate={event.event_date}
      guestCount={event.guest_count}
      kidsCount={event.kids_count}
      status={event.status}
      menuName={menuName}
      items={items}
      notes={event.notes}
      createdAt={event.created_at}
    />
  );
}