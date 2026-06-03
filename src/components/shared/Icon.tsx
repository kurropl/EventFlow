'use client';

/* ✦ Premium icon library — J.Benitez brand ✦
 * Shared set for all admin pages. 24×24 viewBox, 1.5px stroke.
 * Usage: <Icon name="search" /> or <Icon name="trash" className="w-4 h-4" />
 */

interface IconProps {
  name: string;
  className?: string;
}

export default function Icon({ name, className = 'w-[18px] h-[18px]' }: IconProps) {
  const p: Record<string, React.ReactNode> = {

    // ── Navigation (sidebar) ─────────────────────────────────
    dashboard: (
      <><rect x="3" y="3" width="8" height="8" rx="1.5" fill="none" /><rect x="13" y="3" width="8" height="5" rx="1.5" fill="none" /><rect x="13" y="12" width="8" height="9" rx="1.5" fill="none" /><rect x="3" y="15" width="8" height="6" rx="1.5" fill="none" /><path d="M19 8v.01M7 18v.01" strokeWidth="2.5" strokeLinecap="round" /></>
    ),
    agenda: (
      <><rect x="3" y="4" width="18" height="17" rx="2" fill="none" /><path d="M3 10h18" /><path d="M8 2v4M16 2v4" /><circle cx="17" cy="16" r="3" fill="none" /><path d="M17 14.5v1.5l1 .5" strokeLinecap="round" /></>
    ),
    leads: (
      <><circle cx="12" cy="8" r="4.5" fill="none" /><path d="M3 21c0-4.97 4.03-9 9-9" fill="none" /><path d="M16 5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 16h-6" strokeLinecap="round" /><path d="M18 13v6" strokeLinecap="round" /></>
    ),
    kanban: (
      <><rect x="2.5" y="3" width="6" height="18" rx="1.5" fill="none" /><rect x="15.5" y="3" width="6" height="12" rx="1.5" fill="none" /><path d="M20.5 8v.01" strokeWidth="2.5" strokeLinecap="round" /><path d="M5.5 8v.01" strokeWidth="2.5" strokeLinecap="round" /></>
    ),
    clientes: (
      <><circle cx="9" cy="8" r="3.5" fill="none" /><path d="M3 21c0-4.42 3.36-8 7-8h3c.43 0 .85.04 1.26.12" fill="none" /><circle cx="18.5" cy="16.5" r="3.5" fill="none" /><path d="M15 21c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5" fill="none" /></>
    ),
    cobros: (
      <><rect x="2" y="5" width="20" height="14" rx="2" fill="none" /><path d="M2 11h20" /><circle cx="12" cy="14" r="3" fill="none" /><path d="M12 12v4M10.5 13.5L12 12l1.5 1.5" strokeLinecap="round" strokeLinejoin="round" /></>
    ),
    invitados: (
      <><circle cx="12" cy="8" r="4.5" fill="none" /><path d="M4 21c0-4.97 4.03-9 9-9" fill="none" /><path d="M18 17l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></>
    ),
    catalog: (
      <><path d="M4 5h16M4 12h16" /><path d="M4 19h10" /><circle cx="20" cy="17" r="3" fill="none" /><path d="M20 15.5v3M18.5 17h3" strokeLinecap="round" /></>
    ),
    operations: (
      <><circle cx="12" cy="12" r="2.5" fill="none" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" /><circle cx="5" cy="5" r="1.5" fill="none" /><circle cx="19" cy="5" r="1.5" fill="none" /><circle cx="5" cy="19" r="1.5" fill="none" /><circle cx="19" cy="19" r="1.5" fill="none" /></>
    ),
    mapa: (
      <><rect x="3" y="3" width="18" height="18" rx="2" fill="none" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /><circle cx="12" cy="12" r="2" fill="none" /></>
    ),
    webhooks: (
      <><path d="M12 2a6 6 0 0 0-4.24 10.24l-3.53 3.53M12 22a6 6 0 0 0 4.24-10.24l3.53-3.53" /><circle cx="5" cy="19" r="2.5" fill="none" /><circle cx="19" cy="5" r="2.5" fill="none" /></>
    ),
    proveedores: (
      <><path d="M17 20v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v3" fill="none" /><circle cx="10" cy="7" r="4" fill="none" /><path d="M21 15v2" strokeLinecap="round" /><path d="M20 16h2" strokeLinecap="round" /></>
    ),
    portal: (
      <><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></>
    ),

    // ── Actions ───────────────────────────────────────────────
    trash: (
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1.4 14a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
    edit: (
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
    plus: (
      <><circle cx="12" cy="12" r="9" fill="none" /><path d="M12 8v8M8 12h8" strokeLinecap="round" /></>
    ),
    search: (
      <><circle cx="11" cy="11" r="7" fill="none" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" /></>
    ),
    download: (
      <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" fill="none" /><path d="M12 3v12M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></>
    ),
    close: (
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    ),
    menu: (
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    ),
    info: (
      <><circle cx="12" cy="12" r="9" fill="none" /><path d="M12 16v-4" strokeLinecap="round" /><circle cx="12" cy="8" r="0.5" fill="currentColor" /></>
    ),
    spinner: (
      <path d="M21 12a9 9 0 1 1-6.22-8.56" strokeLinecap="round" />
    ),

    // ── KPI / Metric ──────────────────────────────────────────
    revenue: (
      <><rect x="2" y="5" width="20" height="14" rx="2" fill="none" /><path d="M2 11h20" /><circle cx="12" cy="14" r="3" fill="none" /><path d="M12 12v1" strokeLinecap="round" /></>
    ),
    pending: (
      <><path d="M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9z" fill="none" /><path d="M12 7v5l3 3" strokeLinecap="round" /></>
    ),
    guests: (
      <><circle cx="9" cy="7" r="4" fill="none" /><path d="M3 21c0-4.97 4.03-9 9-9" fill="none" /><path d="M17 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></>
    ),
    conversion: (
      <><path d="M22 12h-4l-3 9L9 3l-3 9H2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>
    ),
    calendar: (
      <><rect x="3" y="4" width="18" height="17" rx="2" fill="none" /><path d="M3 10h18" /><path d="M8 2v4M16 2v4" /></>
    ),
    clock: (
      <><circle cx="12" cy="12" r="9" fill="none" /><path d="M12 7v5l3 3" strokeLinecap="round" /></>
    ),
    cheque: (
      <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
    ),
    food: (
      <path d="M6 2l3 9H3l3-9z M15 2v9c0 2.5 1.5 4 4 4V2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
    star: (
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
    refresh: (
      <path d="M23 4v6h-6M1 20v-6h6" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
    email: (
      <><rect x="2" y="4" width="20" height="16" rx="2" fill="none" /><path d="M22 6l-10 7L2 6" strokeLinecap="round" strokeLinejoin="round" /></>
    ),
    phone: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.08 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.56 12.56 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.56 12.56 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
    pin: (
      <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" /><circle cx="12" cy="10" r="3" fill="none" /></>
    ),

    // ── Status ────────────────────────────────────────────────
    check: (
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    ),
    x: (
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    ),
    arrowLeft: (
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    ),
    arrowRight: (
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    ),
    chevronDown: (
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    ),
    chevronUp: (
      <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    ),
    external: (
      <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" fill="none" /><path d="M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" /></>
    ),

    // ── Logout ────────────────────────────────────────────────
    logout: (
      <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" /><path d="M16 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12H9" strokeLinecap="round" /></>
    ),
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {p[name] || p.info}
    </svg>
  );
}