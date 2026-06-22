'use client';

/**
 * CocinaAlerts — Alertas inteligentes para la cocina
 *
 * Muestra en tiempo real:
 * - Ingredientes próximos a caducar
 * - Stock bajo
 * - Últimas recepciones escaneadas
 *
 * J.Benitez — EventFlow ERP
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Package, ArrowDown, RefreshCw, AlertCircle } from 'lucide-react';

interface ExpiringItem {
  id: string;
  lotNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  ingredientName: string;
  batchQuantity: number;
  unit: string;
  supplier: string | null;
}

interface LowStockItem {
  ingredientName: string;
  quantity: number;
  minStock: number;
  deficit: number;
  unit: string;
}

interface RecentReceivingItem {
  id: string;
  lotNumber: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  supplier: string | null;
  receivedDate: string;
}

interface AlertCounts {
  critical: number;
  warning: number;
  lowStock: number;
  receivedToday: number;
}

export default function CocinaAlerts() {
  const [expiring, setExpiring] = useState<ExpiringItem[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [recent, setRecent] = useState<RecentReceivingItem[]>([]);
  const [counts, setCounts] = useState<AlertCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'caducar' | 'stock' | 'recepciones'>('caducar');

  const load = () => {
    setLoading(true);
    fetch('/api/cocina/alertas?days=7')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setExpiring(d.data.expiringSoon);
          setLowStock(d.data.lowStock);
          setRecent(d.data.recentReceiving);
          setCounts(d.data.counts);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const severityColor = (days: number) => {
    if (days <= 0) return 'text-red-600 bg-red-50 border-red-200';
    if (days <= 3) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  };

  const daysLabel = (days: number) => {
    if (days <= 0) return 'CADUCADO';
    if (days === 1) return '1 día';
    return `${days} días`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-stone-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          Alertas de Cocina
        </h3>
        <button onClick={load} className="p-1.5 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Counts bar */}
      {counts && (
        <div className="grid grid-cols-4 gap-2">
          <div className={`p-2 rounded-lg text-center ${counts.critical > 0 ? 'bg-red-50 border border-red-200' : 'bg-stone-50'}`}>
            <p className={`text-lg font-bold font-mono ${counts.critical > 0 ? 'text-red-600' : 'text-stone-400'}`}>{counts.critical}</p>
            <p className="text-[9px] text-stone-500 uppercase tracking-wider">Críticos</p>
          </div>
          <div className={`p-2 rounded-lg text-center ${counts.warning > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-stone-50'}`}>
            <p className={`text-lg font-bold font-mono ${counts.warning > 0 ? 'text-amber-600' : 'text-stone-400'}`}>{counts.warning}</p>
            <p className="text-[9px] text-stone-500 uppercase tracking-wider">Próximos</p>
          </div>
          <div className={`p-2 rounded-lg text-center ${counts.lowStock > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-stone-50'}`}>
            <p className={`text-lg font-bold font-mono ${counts.lowStock > 0 ? 'text-orange-600' : 'text-stone-400'}`}>{counts.lowStock}</p>
            <p className="text-[9px] text-stone-500 uppercase tracking-wider">Stock bajo</p>
          </div>
          <div className="p-2 rounded-lg bg-green-50 text-center">
            <p className="text-lg font-bold font-mono text-green-600">{counts.receivedToday}</p>
            <p className="text-[9px] text-stone-500 uppercase tracking-wider">Hoy</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
        {[
          { id: 'caducar' as const, label: 'Caducan', icon: Clock, count: expiring.length },
          { id: 'stock' as const, label: 'Stock bajo', icon: ArrowDown, count: lowStock.length },
          { id: 'recepciones' as const, label: 'Recepciones', icon: Package, count: recent.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all
              ${activeTab === tab.id ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count > 0 && <span className="text-[10px] text-stone-400">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <div className="text-center py-8 text-stone-400 text-xs">Cargando alertas...</div>}

      {/* Tab: Caducan */}
      {activeTab === 'caducar' && !loading && (
        <div className="space-y-2">
          {expiring.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-xs">
              <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
              No hay ingredientes próximos a caducar
            </div>
          ) : (
            expiring.map(item => (
              <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${severityColor(item.daysUntilExpiry)}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{item.ingredientName}</p>
                    <p className="text-[10px] opacity-70">
                      Lote: {item.lotNumber} {item.supplier && `— ${item.supplier}`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={`text-xs font-bold ${item.daysUntilExpiry <= 0 ? 'text-red-600' : ''}`}>
                    {daysLabel(item.daysUntilExpiry)}
                  </p>
                  <p className="text-[10px] opacity-60">{item.quantity} {item.unit}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Stock bajo */}
      {activeTab === 'stock' && !loading && (
        <div className="space-y-2">
          {lowStock.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-xs">
              <Package className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Todo el stock está dentro de los mínimos
            </div>
          ) : (
            lowStock.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50">
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowDown className="w-4 h-4 text-orange-500 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-orange-800">{item.ingredientName}</p>
                    <p className="text-[10px] text-orange-600">{item.quantity} {item.unit} actual — mínimo {item.minStock} {item.unit}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs font-bold text-red-600">-{item.deficit}</p>
                  <p className="text-[10px] text-orange-600">déficit</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Recepciones recientes */}
      {activeTab === 'recepciones' && !loading && (
        <div className="space-y-2">
          {recent.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-xs">
              <Package className="w-6 h-6 mx-auto mb-2 opacity-40" />
              No hay recepciones registradas
            </div>
          ) : (
            recent.slice(0, 10).map(item => (
              <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-stone-200 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                    <Package className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-700 truncate">{item.ingredientName}</p>
                    <p className="text-[10px] text-stone-400">
                      {item.quantity} {item.unit}{item.supplier ? ` — ${item.supplier}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-[10px] text-stone-500">{new Date(item.receivedDate).toLocaleDateString('es-ES')}</p>
                  {item.lotNumber && <p className="text-[9px] text-stone-400">Lote: {item.lotNumber}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}