'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Spinner } from '@/components/ui';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

interface Worker {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'error' | 'stopped';
  last_run: string | null;
  next_run: string | null;
  task: string;
}

export default function ConfigIntegrationsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'webhooks' | 'workers'>('webhooks');

  useEffect(() => {
    Promise.all([
      fetch('/api/webhooks').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/workers').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([wh, wr]) => {
      setWebhooks(wh.data || []);
      setWorkers(wr.data || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-divider/50 p-4 sm:p-5">
        <h1 className="text-sm font-medium text-ink">Integraciones</h1>
        <p className="text-xs text-ink-soft mt-0.5">Webhooks, Workers y configuración de API</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white rounded-lg border border-divider p-0.5 w-fit">
        {(['webhooks', 'workers'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === tab ? 'bg-ink text-white shadow-sm' : 'text-ink-soft hover:text-ink'
            }`}>
            {tab === 'webhooks' ? 'Webhooks' : 'Tareas Programadas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-white border border-divider animate-pulse" />)}</div>
      ) : activeTab === 'webhooks' ? (
        webhooks.length === 0 ? (
          <div className="bg-white rounded-xl border border-divider/60 p-8 text-center">
            <p className="text-xs text-ink-soft">No hay webhooks configurados. Los webhooks permiten notificar a sistemas externos cuando ocurren eventos.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {webhooks.map(wh => (
              <div key={wh.id} className="bg-white rounded-xl border border-divider/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-ink">{wh.name}</p>
                    <p className="text-[11px] text-ink-soft mt-0.5">{wh.url}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${wh.active ? 'bg-success/10 text-success' : 'bg-ink-soft/10 text-ink-soft'}`}>
                    {wh.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {wh.events.map(ev => (
                    <span key={ev} className="px-1.5 py-0.5 rounded bg-cream text-[10px] text-ink-soft">{ev}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        workers.length === 0 ? (
          <div className="bg-white rounded-xl border border-divider/60 p-8 text-center">
            <p className="text-xs text-ink-soft">No hay tareas programadas. Las tareas permiten automatizar procesos como envío de recordatorios o limpieza de datos.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {workers.map(w => (
              <div key={w.id} className="bg-white rounded-xl border border-divider/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-ink">{w.name}</p>
                    <p className="text-[11px] text-ink-soft mt-0.5">{w.task}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    w.status === 'running' ? 'bg-success/10 text-success' :
                    w.status === 'error' ? 'bg-danger/10 text-danger' :
                    'bg-ink-soft/10 text-ink-soft'
                  }`}>{w.status}</span>
                </div>
                {w.last_run && <p className="text-[10px] text-ink-soft mt-1.5">Última ejecución: {new Date(w.last_run).toLocaleString()}</p>}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}