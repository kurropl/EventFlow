'use client';

import React from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

/* ─── Compact KPI Card ─── */
export function KpiCard({ icon, label, value, sub, href, onClick, color }: {
  icon: string; label: string; value: string | number; sub?: string;
  href?: string; onClick?: () => void; color?: string;
}) {
  const colorMap: Record<string, string> = {
    gold: 'bg-gold/10 text-gold',
    green: 'bg-success/10 text-success',
    red: 'bg-danger/10 text-danger',
    blue: 'bg-blue-500/10 text-blue-600',
    purple: 'bg-purple-500/10 text-purple-600',
    ink: 'bg-ink/5 text-ink',
  };
  const c = color ? (colorMap[color] || colorMap.ink) : colorMap.ink;

  return (
    <div onClick={onClick} className={cn(
      'bg-white rounded-lg border border-divider/50 p-3 flex items-center gap-3',
      onClick && 'cursor-pointer hover:shadow-sm hover:-translate-y-0.5 transition-all'
    )}>
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', c)}>
        <Icon name={icon} className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink leading-tight">{value}</p>
        <p className="text-[10px] text-ink-soft truncate">{label}</p>
        {sub && <p className="text-[9px] text-ink-soft/60">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Compact Section Card ─── */
export function SectionCard({ title, icon, children, badge, actions, className }: {
  title: string; icon: string; children: React.ReactNode;
  badge?: string; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('bg-white rounded-lg border border-divider/50 overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-cream/50 border-b border-divider/40">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={icon} className="w-3.5 h-3.5 text-gold shrink-0" />
          <h3 className="text-[11px] font-medium text-ink truncate">{title}</h3>
          {badge && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/10 text-gold-dark font-medium">{badge}</span>}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

/* ─── Compact Event Selector ─── */
export function EventSelector({ events, value, onChange, label }: {
  events: { id: string; client_name: string; event_date: string; guest_count: number }[];
  value: string; onChange: (v: string) => void; label?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-center gap-3">
      <div className="flex-1">
        <label className="text-[10px] text-ink-soft font-medium block mb-0.5">{label || 'Evento'}</label>
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg border border-divider text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-gold/20">
          <option value="">— Seleccionar —</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.client_name} — {ev.event_date ? formatDate(ev.event_date) : ''} ({ev.guest_count}pax)
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ─── Compact Checkbox Row ─── */
export function CheckRow({ checked, onChange, label, sub, actions }: {
  checked: boolean; onChange: () => void; label: string;
  sub?: string; actions?: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-center gap-2.5 py-1.5', checked && 'opacity-50')}>
      <button onClick={onChange}
        className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
          checked ? 'bg-success border-success text-white' : 'border-divider hover:border-gold')}>
        {checked && <Icon name="check" className="w-2.5 h-2.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[11px] font-medium text-ink', checked && 'line-through')}>{label}</p>
        {sub && <p className="text-[9px] text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}

/* ─── Compact Input ─── */
export function CompactInput({ value, onChange, placeholder, type, className, suffix }: {
  value: string | number; onChange: (v: any) => void;
  placeholder?: string; type?: string; className?: string; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input type={type || 'text'} value={value ?? ''} onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className={cn('w-full px-2 py-1 rounded border border-divider text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-gold/20', className)} />
      {suffix && <span className="text-[9px] text-ink-soft">{suffix}</span>}
    </div>
  );
}

/* ─── Status Badge ─── */
export function Badge({ label, variant }: { label: string; variant?: 'ok' | 'warn' | 'error' | 'info' }) {
  const v = variant || 'info';
  const map = {
    ok: 'bg-success/10 text-success',
    warn: 'bg-warning/10 text-warning',
    error: 'bg-danger/10 text-danger',
    info: 'bg-cream text-ink-soft',
  };
  return <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-medium', map[v])}>{label}</span>;
}

/* ─── Empty State ─── */
export function Empty({ icon, title, sub, action }: {
  icon: string; title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-divider/50 p-6 text-center">
      <div className="w-10 h-10 rounded-lg bg-cream flex items-center justify-center mx-auto mb-2">
        <Icon name={icon} className="w-5 h-5 text-ink-soft/40" />
      </div>
      <p className="text-xs font-medium text-ink mb-0.5">{title}</p>
      {sub && <p className="text-[10px] text-ink-soft max-w-xs mx-auto">{sub}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ─── Progress Bar ─── */
export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-cream overflow-hidden">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-ink-soft">{value}/{max}</span>
    </div>
  );
}