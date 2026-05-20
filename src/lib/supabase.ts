/**
 * EventFlow — Supabase Client (Typed)
 *
 * Provides both server-side and browser-side Supabase clients.
 * Server-side client is used in API routes (has full DB access).
 * Browser-side client is used in client components (RLS-protected).
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================
// Database Types (mirrors schema.sql)
// ============================================================

export type Database = {
  public: {
    Tables: {
      catalog_items: {
        Row: {
          id: string;
          name: string;
          category: string;
          subcategory: string | null;
          pvp: number;
          cost: number;
          ingredientes_base: Record<string, unknown>[];
          image_url: string | null;
          active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['catalog_items']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<
          Database['public']['Tables']['catalog_items']['Row']
        >;
      };
      events: {
        Row: {
          id: string;
          menu_id: string | null;
          client_name: string;
          client_email: string;
          client_phone: string | null;
          event_type: string;
          guest_count: number;
          kids_count: number;
          event_date: string;
          status: string;
          selected_items: Record<string, unknown>[];
          total_pvp: number;
          total_cost: number;
          bar_hours: number;
          bar_price: number;
          iva_pct: number;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['events']['Row'],
          'id' | 'created_at' | 'updated_at'
        > & { menu_id?: string | null };
        Update: Partial<
          Database['public']['Tables']['events']['Row']
        >;
      };
      cost_desgloses: {
        Row: {
          id: string;
          event_id: string;
          line_type: string;
          description: string;
          quantity: number;
          unit_price: number;
          total: number;
          created_at: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['cost_desgloses']['Row'],
          'id' | 'created_at'
        >;
        Update: Partial<
          Database['public']['Tables']['cost_desgloses']['Row']
        >;
      };
      proposed_menus: {
        Row: {
          id: string;
          name: string;
          tag: string;
          suggested_price: number;
          is_kid: boolean;
          sections: Record<string, unknown>[];
          created_at: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['proposed_menus']['Row'],
          'created_at'
        >;
        Update: Partial<
          Database['public']['Tables']['proposed_menus']['Row']
        >;
      };
      webhook_logs: {
        Row: {
          id: string;
          event_id: string | null;
          topic: string;
          payload: Record<string, unknown>;
          status: string;
          response: string | null;
          retries: number;
          sent_at: string | null;
          created_at: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['webhook_logs']['Row'],
          'id' | 'created_at'
        >;
        Update: Partial<
          Database['public']['Tables']['webhook_logs']['Row']
        >;
      };
      bar_config: {
        Row: {
          hours: number;
          price: number;
          label: string;
        };
        Insert: Omit<
          Database['public']['Tables']['bar_config']['Row'],
          never
        >;
        Update: Partial<
          Database['public']['Tables']['bar_config']['Row']
        >;
      };
    };
    Views: {
      catalog_summary: {
        Row: {
          id: string;
          name: string;
          category: string;
          subcategory: string | null;
          pvp: number;
          cost: number;
          margin_pct: number | null;
          margin_abs: number | null;
          ingredients: Record<string, unknown>[];
          image_url: string | null;
          active: boolean;
        };
      };
      event_summary: {
        Row: {
          id: string;
          menu_id: string | null;
          client_name: string;
          client_email: string;
          event_type: string;
          guest_count: number;
          kids_count: number;
          event_date: string;
          status: string;
          total_pvp: number;
          total_cost: number;
          bar_hours: number;
          bar_price: number;
          iva_pct: number;
          margin_pct: number | null;
          profit_abs: number | null;
          selected_items: Record<string, unknown>[];
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

// ============================================================
// Shared environment (used by validation in seed script)
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============================================================
// Server-side client (used in API routes)
// ============================================================

export function getSupabaseServerClient(): ReturnType<typeof createClient> & { _type: 'server' } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key) as ReturnType<typeof createClient> & { _type: 'server' };
}

// ============================================================
// Browser-side client (used in client components)
// ============================================================

export function getSupabaseBrowserClient(): ReturnType<typeof createClient> & { _type: 'browser' } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key) as ReturnType<typeof createClient> & { _type: 'browser' };
}

// ============================================================
// Re-export convenience types
// ============================================================

export type CatalogItemRow = Database['public']['Tables']['catalog_items']['Row'];
export type CatalogItemInsert = Database['public']['Tables']['catalog_items']['Insert'];
export type CatalogItemUpdate = Database['public']['Tables']['catalog_items']['Update'];

export type EventRow = Database['public']['Tables']['events']['Row'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];

export type CostDesgloseRow = Database['public']['Tables']['cost_desgloses']['Row'];
export type CostDesgloseInsert = Database['public']['Tables']['cost_desgloses']['Insert'];
export type CostDesgloseUpdate = Database['public']['Tables']['cost_desgloses']['Update'];

export type ProposedMenuRow = Database['public']['Tables']['proposed_menus']['Row'];
export type ProposedMenuInsert = Database['public']['Tables']['proposed_menus']['Insert'];
export type ProposedMenuUpdate = Database['public']['Tables']['proposed_menus']['Update'];

export type WebhookLogRow = Database['public']['Tables']['webhook_logs']['Row'];
export type WebhookLogInsert = Database['public']['Tables']['webhook_logs']['Insert'];
export type WebhookLogUpdate = Database['public']['Tables']['webhook_logs']['Update'];

export type BarConfigRow = Database['public']['Tables']['bar_config']['Row'];
export type BarConfigInsert = Database['public']['Tables']['bar_config']['Insert'];
export type BarConfigUpdate = Database['public']['Tables']['bar_config']['Update'];
