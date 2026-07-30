'use client';

/**
 * TrazabilidadPanel — Panel de trazabilidad sanitaria para EventFlow
 * 4 tabs:
 *  1. Inventario      → tabla ingredientes + stock + min_stock + alerta + ajuste
 *  2. Recepciones     → historial + filtros + formulario de recepción con QR
 *  3. Lotes x evento  → selector de evento → lotes consumidos
 *  4. Informe APPCC   → selector de evento → trazabilidad completa
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/shared/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import QrScanner from '@/components/b2b/QrScanner';
import { parseGS1 } from '@/lib/gs1Parser';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InventoryItem {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  min_stock: number | null;
  low_stock: boolean;
  last_movement_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ReceivingRecord {
  id: string;
  supplier_order_id: string | null;
  ingredient_id: string;
  ingredient_name: string;
  lot_number: string;
  batch_quantity: number;
  unit: string;
  received_date: string;
  received_by: string | null;
  expiry_date: string | null;
  temperature: number | null;
  supplier: string | null;
  condition_ok: boolean;
  source: string | null;
  qr_code: string | null;
  notes: string | null;
  created_at: string;
  temp_alert: boolean;
}

interface EventOption {
  id: string;
  client_name: string;
  event_date: string;
  status: string;
}

interface LotConsumption {
  id: string;
  receiving_log_id: string;
  event_id: string;
  quantity_consumed: number;
  unit: string;
  consumed_at: string;
  lot_number: string;
  batch_quantity: number;
  expiry_date: string | null;
  temperature: number | null;
  supplier: string | null;
  ingredient_id: string;
  ingredient_name: string;
}

interface AppccTraceItem {
  shopping_item_id: string;
  ingredient_name: string;
  shopping_provider: string | null;
  total_grams: number | null;
  total_units: number | null;
  total_ml: number | null;
  actual_cost: number | null;
  unit_dimension: string | null;
  completed: boolean;
  consumption_id: string | null;
  quantity_consumed: number | null;
  consumption_unit: string | null;
  consumed_at: string | null;
  lot_number: string | null;
  batch_quantity: number | null;
  receiving_unit: string | null;
  received_date: string | null;
  expiry_date: string | null;
  temperature: number | null;
  supplier: string | null;
  condition_ok: boolean | null;
  qr_code: string | null;
  receiving_notes: string | null;
  temp_alert: boolean;
}

interface LotOption {
  id: string;
  lot_number: string;
  ingredient_name: string;
  supplier: string | null;
  received_date: string;
  expiry_date: string | null;
  batch_quantity: number;
  unit: string;
}

interface LotTraceability {
  lot: {
    id: string;
    lot_number: string;
    batch_quantity: number;
    unit: string;
    received_date: string;
    received_by: string | null;
    expiry_date: string | null;
    temperature: number | null;
    supplier: string | null;
    condition_ok: boolean;
    source: string | null;
    qr_code: string | null;
    notes: string | null;
    created_at: string;
    ingredient: {
      id: string;
      name: string;
      category: string;
      unit: string;
    };
    supplier_order: {
      id: string;
      status: string;
    } | null;
  };
  summary: {
    total_received: number;
    total_consumed: number;
    remaining: number;
    consumption_count: number;
    unit: string;
  };
  alerts: {
    temperature: string | null;
    expiry: string | null;
  };
  consumptions: Array<{
    consumption_id: string;
    quantity_consumed: number;
    unit: string;
    consumed_at: string;
    event: {
      id: string;
      client_name: string;
      event_date: string;
      event_type: string;
      guest_count: number;
      status: string;
      venue_type: string;
    };
  }>;
}

interface AppccAlert {
  temperature: string | null;
}

interface AppccResponse {
  event: {
    id: string;
    client_name: string;
    event_date: string;
    event_type: string;
    guest_count: number;
    status: string;
  };
  trace: AppccTraceItem[];
  available_lots: any[];
  alerts: AppccAlert;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function stockStatus(qty: number, min: number | null) {
  if (qty <= 0) return { label: 'Agotado', icon: 'circleX' as const, color: 'text-danger', bg: 'bg-danger/10' };
  if (min !== null && qty <= min) return { label: 'Bajo', icon: 'alertTriangle' as const, color: 'text-warning', bg: 'bg-warning/10' };
  return { label: 'OK', icon: 'check-circle' as const, color: 'text-success', bg: 'bg-success/10' };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
}

function formatTemp(t: number | null | undefined) {
  if (t === null || t === undefined) return '—';
  return `${t.toFixed(1)}°C`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TrazabilidadPanel() {
  const [activeTab, setActiveTab] = useState('inventario');

  /* ── Estados compartidos ── */
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* ── Tab 1: Inventario ── */
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  /* ── Tab 2: Recepciones ── */
  const [receivings, setReceivings] = useState<ReceivingRecord[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recFilterSupplier, setRecFilterSupplier] = useState('');
  const [recFilterLot, setRecFilterLot] = useState('');
  // Formulario de recepción
  const [showRecForm, setShowRecForm] = useState(false);
  const [recForm, setRecForm] = useState({
    ingredient_name: '',
    ingredient_id: '',
    lot_number: '',
    batch_quantity: '',
    unit: 'g',
    received_by: '',
    expiry_date: '',
    temperature: '',
    supplier: '',
    qr_code: '',
    notes: '',
    condition_ok: true,
    source: 'manual' as 'manual' | 'scan',
  });
  const [scanNotice, setScanNotice] = useState('');
  const [recFormLoading, setRecFormLoading] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientOptions, setIngredientOptions] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [showIngDropdown, setShowIngDropdown] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  /* ── Tab 3: Lotes por evento ── */
  const [selectedEventLot, setSelectedEventLot] = useState('');
  const [lotConsumption, setLotConsumption] = useState<LotConsumption[]>([]);
  const [lotEventInfo, setLotEventInfo] = useState<EventOption | null>(null);
  const [lotLoading, setLotLoading] = useState(false);

  /* ── Tab 4: Informe APPCC ── */
  const [selectedEventAppcc, setSelectedEventAppcc] = useState('');
  const [appccData, setAppccData] = useState<AppccResponse | null>(null);
  const [appccLoading, setAppccLoading] = useState(false);

  /* ── Tab 5: Trazabilidad por Lote ── */
  const [lotOptions, setLotOptions] = useState<LotOption[]>([]);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [lotTraceData, setLotTraceData] = useState<LotTraceability | null>(null);
  const [lotTraceLoading, setLotTraceLoading] = useState(false);
  const [lotFilterSearch, setLotFilterSearch] = useState('');

  /* ================================================================ */
  /*  Cargar eventos al inicio                                         */
  /* ================================================================ */

  useEffect(() => {
    fetch('/api/events?limit=100')
      .then((r) => r.json())
      .then((d) => d.success && setEvents((d.data || []).map((ev: any) => ({
        id: ev.id,
        client_name: ev.client_name || 'Sin nombre',
        event_date: ev.event_date,
        status: ev.status,
      }))))
      .catch(() => {});
  }, []);

  /* ================================================================ */
  /*  Tab 1: Inventario                                                */
  /* ================================================================ */

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    try {
      const res = await fetch('/api/trazabilidad/inventory');
      const d = await res.json();
      if (d.success) {
        setInventory(d.data);
      } else {
        setError(d.error || 'Error al cargar inventario');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setInvLoading(false);
  }, []);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  const handleAdjust = async () => {
    if (!adjustDialog) return;
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty < 0) {
      setError('Cantidad inválida');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/trazabilidad/inventory/${adjustDialog.ingredient_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty, notes: adjustNotes || undefined }),
      });
      const d = await res.json();
      if (d.success) {
        setAdjustDialog(null);
        setAdjustQty('');
        setAdjustNotes('');
        await loadInventory();
      } else {
        setError(d.error || 'Error al ajustar');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  /* ================================================================ */
  /*  Tab 2: Recepciones                                               */
  /* ================================================================ */

  const loadReceivings = useCallback(async () => {
    setRecLoading(true);
    try {
      const params = new URLSearchParams();
      if (recFilterSupplier) params.set('supplier', recFilterSupplier);
      if (recFilterLot) params.set('lot', recFilterLot);
      const res = await fetch(`/api/trazabilidad/receiving?${params.toString()}`);
      const d = await res.json();
      if (d.success) {
        setReceivings(d.data);
      }
    } catch {}
    setRecLoading(false);
  }, [recFilterSupplier, recFilterLot]);

  useEffect(() => { loadReceivings(); }, [loadReceivings]);

  const searchIngredients = useCallback(async (q: string) => {
    // /api/ingredients nunca existió — GET /api/stock ya soporta buscar por
    // nombre/proveedor (?search=), que es el endpoint real de ingredientes.
    if (!q || q.length < 2) { setIngredientOptions([]); return; }
    try {
      const res = await fetch(`/api/stock?search=${encodeURIComponent(q)}`);
      const d = await res.json();
      if (d.success) {
        setIngredientOptions((d.data || []).slice(0, 10).map((i: any) => ({ id: i.id, name: i.name, unit: i.unit || 'g' })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchIngredients(ingredientSearch), 300);
    return () => clearTimeout(timer);
  }, [ingredientSearch, searchIngredients]);

  const selectIngredient = (ing: { id: string; name: string; unit: string }) => {
    setRecForm((prev) => ({
      ...prev,
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      unit: ing.unit,
    }));
    setIngredientSearch(ing.name);
    setIngredientOptions([]);
    setShowIngDropdown(false);
  };

  const handleQrScan = (decodedText: string) => {
    // Sprint 6 (F1.1): antes solo se volcaba el texto crudo sin rellenar
    // nada — ahora se interpreta como GS1-128 y se auto-rellenan lote y
    // caducidad (el requisito literal del acta: "escáner que te meta la
    // fecha de entrada, los lotes y todo lo de sanidad" — la fecha de
    // entrada ya se auto-asigna en el backend a día de hoy).
    const parsed = parseGS1(decodedText);
    setRecForm((prev) => ({
      ...prev,
      qr_code: decodedText,
      lot_number: parsed?.lot || prev.lot_number,
      expiry_date: parsed?.expiryDate || parsed?.bestBeforeDate || prev.expiry_date,
      source: 'scan',
    }));
    if (parsed?.lot || parsed?.expiryDate || parsed?.bestBeforeDate) {
      const partes = [
        parsed.lot ? `lote ${parsed.lot}` : null,
        (parsed.expiryDate || parsed.bestBeforeDate) ? `caducidad ${parsed.expiryDate || parsed.bestBeforeDate}` : null,
      ].filter(Boolean).join(' y ');
      setScanNotice(`✓ Auto-rellenado desde el código: ${partes}`);
    } else {
      setScanNotice('Código leído, pero no se reconoce como GS1 — revisa lote/caducidad manualmente.');
    }
    setTimeout(() => setScanNotice(''), 6000);
    setShowQrScanner(false);
  };

  const handleSubmitReception = async () => {
    if (!recForm.ingredient_id || !recForm.lot_number || !recForm.batch_quantity) {
      setError('Ingrediente, lote y cantidad son obligatorios');
      return;
    }
    const qty = parseFloat(recForm.batch_quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Cantidad debe ser un número positivo');
      return;
    }
    setRecFormLoading(true);
    try {
      const res = await fetch('/api/trazabilidad/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: recForm.ingredient_id,
          lot_number: recForm.lot_number,
          batch_quantity: qty,
          unit: recForm.unit,
          received_by: recForm.received_by || undefined,
          expiry_date: recForm.expiry_date || undefined,
          temperature: recForm.temperature ? parseFloat(recForm.temperature) : undefined,
          supplier: recForm.supplier || undefined,
          qr_code: recForm.qr_code || undefined,
          condition_ok: recForm.condition_ok,
          notes: recForm.notes || undefined,
          source: recForm.source,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setShowRecForm(false);
        setRecForm({
          ingredient_name: '', ingredient_id: '', lot_number: '', batch_quantity: '',
          unit: 'g', received_by: '', expiry_date: '', temperature: '',
          supplier: '', qr_code: '', notes: '', condition_ok: true, source: 'manual',
        });
        setIngredientSearch('');
        await loadReceivings();
        await loadInventory();
      } else {
        setError(d.error || 'Error al registrar recepción');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setRecFormLoading(false);
  };

  /* ================================================================ */
  /*  Tab 3: Lotes por evento                                          */
  /* ================================================================ */

  const loadLotConsumption = useCallback(async () => {
    if (!selectedEventLot) return;
    setLotLoading(true);
    try {
      const res = await fetch(`/api/trazabilidad/lot-consumption/${selectedEventLot}`);
      const d = await res.json();
      if (d.success) {
        setLotConsumption(d.data.lots || []);
        setLotEventInfo(d.data.event || null);
      } else {
        setError(d.error || 'Error al cargar lotes');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLotLoading(false);
  }, [selectedEventLot]);

  useEffect(() => { loadLotConsumption(); }, [loadLotConsumption]);

  /* ================================================================ */
  /*  Tab 4: Informe APPCC                                             */
  /* ================================================================ */

  const loadAppcc = useCallback(async () => {
    if (!selectedEventAppcc) return;
    setAppccLoading(true);
    try {
      const res = await fetch(`/api/trazabilidad/trace/${selectedEventAppcc}`);
      const d = await res.json();
      if (d.success) {
        setAppccData(d.data);
      } else {
        setError(d.error || 'Error al cargar informe APPCC');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setAppccLoading(false);
  }, [selectedEventAppcc]);

  useEffect(() => { loadAppcc(); }, [loadAppcc]);

  /* ================================================================ */
  /*  Tab 5: Trazabilidad por Lote                                    */
  /* ================================================================ */

  // Cargar lista de lotes disponibles
  useEffect(() => {
    fetch('/api/trazabilidad/receiving')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setLotOptions(
            (d.data || []).map((r: any) => ({
              id: r.id,
              lot_number: r.lot_number,
              ingredient_name: r.ingredient_name,
              supplier: r.supplier,
              received_date: r.received_date,
              expiry_date: r.expiry_date,
              batch_quantity: Number(r.batch_quantity),
              unit: r.unit,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const loadLotTraceability = useCallback(async () => {
    if (!selectedLotId) return;
    setLotTraceLoading(true);
    try {
      const res = await fetch(`/api/trazabilidad/lot/${selectedLotId}`);
      const d = await res.json();
      if (d.success) {
        setLotTraceData(d.data);
      } else {
        setError(d.error || 'Error al cargar trazabilidad del lote');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLotTraceLoading(false);
  }, [selectedLotId]);

  useEffect(() => { loadLotTraceability(); }, [loadLotTraceability]);

  // Filtrar lotes por búsqueda
  const filteredLots = lotOptions.filter((lot) => {
    if (!lotFilterSearch) return true;
    const search = lotFilterSearch.toLowerCase();
    return (
      lot.lot_number.toLowerCase().includes(search) ||
      lot.ingredient_name.toLowerCase().includes(search) ||
      (lot.supplier && lot.supplier.toLowerCase().includes(search))
    );
  });

  // Generar PDF de trazabilidad del lote
  const generateLotPdf = async () => {
    if (!lotTraceData) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const { lot, summary, alerts, consumptions } = lotTraceData;

      // Cabecera
      doc.setFontSize(18);
      doc.text('Informe de Trazabilidad por Lote', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

      // Datos del lote
      doc.setFontSize(12);
      doc.text('Datos del Lote', 14, 40);
      doc.setFontSize(10);
      let y = 48;
      const addLine = (label: string, value: string) => {
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 14, y);
        doc.setFont(undefined, 'normal');
        doc.text(value, 70, y);
        y += 6;
      };

      addLine('Nº de Lote', lot.lot_number);
      addLine('Ingrediente', lot.ingredient.name);
      addLine('Proveedor', lot.supplier || '—');
      addLine('Cantidad recibida', `${summary.total_received} ${summary.unit}`);
      addLine('Fecha de recepción', lot.received_date ? new Date(lot.received_date).toLocaleDateString('es-ES') : '—');
      addLine('Recibido por', lot.received_by || '—');
      addLine('Caducidad', lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('es-ES') : '—');
      addLine('Temperatura', lot.temperature !== null ? `${lot.temperature}°C` : '—');
      addLine('Estado', lot.condition_ok ? 'Aceptado' : 'Rechazado');
      if (lot.qr_code) addLine('Código QR', lot.qr_code);
      if (lot.notes) addLine('Notas', lot.notes);

      // Alertas
      if (alerts.temperature || alerts.expiry) {
        y += 4;
        doc.setFontSize(12);
        doc.text('Alertas', 14, y);
        y += 8;
        doc.setFontSize(10);
        if (alerts.temperature) {
          doc.setTextColor(200, 0, 0);
          doc.text(`⚠ ${alerts.temperature}`, 14, y);
          y += 6;
        }
        if (alerts.expiry) {
          doc.setTextColor(200, 0, 0);
          doc.text(`⚠ ${alerts.expiry}`, 14, y);
          y += 6;
        }
        doc.setTextColor(0, 0, 0);
      }

      // Resumen
      y += 4;
      doc.setFontSize(12);
      doc.text('Resumen de Consumo', 14, y);
      y += 8;
      doc.setFontSize(10);
      addLine('Total recibido', `${summary.total_received} ${summary.unit}`);
      addLine('Total consumido', `${summary.total_consumed} ${summary.unit}`);
      addLine('Restante', `${summary.remaining} ${summary.unit}`);
      addLine('Eventos que consumieron', `${summary.consumption_count}`);

      // Detalle de consumos por evento
      if (consumptions.length > 0) {
        y += 4;
        doc.setFontSize(12);
        doc.text('Detalle por Evento', 14, y);
        y += 8;

        // Cabecera de tabla
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text('Fecha', 14, y);
        doc.text('Evento', 44, y);
        doc.text('Tipo', 100, y);
        doc.text('Pax', 120, y);
        doc.text('Consumido', 135, y);
        y += 5;
        doc.setFont(undefined, 'normal');

        for (const c of consumptions) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const eventDate = c.event.event_date
            ? new Date(c.event.event_date).toLocaleDateString('es-ES')
            : '—';
          doc.text(eventDate, 14, y);
          doc.text(c.event.client_name?.substring(0, 25) || '—', 44, y);
          doc.text(c.event.event_type || '—', 100, y);
          doc.text(String(c.event.guest_count || '—'), 120, y);
          doc.text(`${c.quantity_consumed} ${c.unit}`, 135, y);
          y += 5;
        }
      }

      // Pie de página
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        'EventFlow — Sistema de Gestión de Catering — Documento generado para inspección sanitaria',
        14,
        290
      );

      // Guardar
      doc.save(`trazabilidad-lote-${lot.lot_number}.pdf`);
    } catch (err) {
      setError('Error al generar el PDF');
    }
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <PageHeader
          title="Trazabilidad Sanitaria"
          subtitle="Gestión de inventario, recepciones, lotes e informe APPCC"
        />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl flex items-center gap-2">
          <Icon name="alertCircle" className="w-4 h-4 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-danger/70 hover:text-danger">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  Tabs                                                         */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start gap-1 bg-cream p-1 rounded-xl border border-cream-dark overflow-x-auto">
          <TabsTrigger value="inventario" className="data-[state=active]:bg-white data-[state=active]:text-warning data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Icon name="package" className="w-4 h-4 mr-1.5" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="recepciones" className="data-[state=active]:bg-white data-[state=active]:text-warning data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Icon name="truck" className="w-4 h-4 mr-1.5" />
            Recepciones
          </TabsTrigger>
          <TabsTrigger value="lotes" className="data-[state=active]:bg-white data-[state=active]:text-warning data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Icon name="layers" className="w-4 h-4 mr-1.5" />
            Lotes por evento
          </TabsTrigger>
          <TabsTrigger value="appcc" className="data-[state=active]:bg-white data-[state=active]:text-warning data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Icon name="clipboardCheck" className="w-4 h-4 mr-1.5" />
            Informe APPCC
          </TabsTrigger>
          <TabsTrigger value="lot-trace" className="data-[state=active]:bg-white data-[state=active]:text-warning data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Icon name="search" className="w-4 h-4 mr-1.5" />
            Trazabilidad por Lote
          </TabsTrigger>
        </TabsList>

        {/* ─────────────────────────────────────────────────────────── */}
        {/*  TAB 1: INVENTARIO                                          */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="inventario" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">
              {inventory.length} ingrediente{inventory.length !== 1 ? 's' : ''} en inventario
            </p>
            <Button
              onClick={loadInventory}
              disabled={invLoading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Icon name="refresh" className="w-3.5 h-3.5 mr-1.5" />
              Refrescar
            </Button>
          </div>

          {invLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-cream-dark rounded-lg" />
              ))}
            </div>
          ) : inventory.length === 0 ? (
            <EmptyState
              icon={<Icon name="package" className="w-6 h-6" />}
              title="Sin inventario"
              description="No hay ingredientes registrados en el inventario."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-cream-dark bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream text-left text-xs font-semibold text-ink-soft uppercase tracking-wider">
                    <th className="px-4 py-3">Ingrediente</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Stock mínimo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Último movimiento</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {inventory.map((item) => {
                    const st = stockStatus(item.quantity, item.min_stock);
                    return (
                      <tr key={item.id} className="hover:bg-cream/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-ink">
                          {item.ingredient_name}
                        </td>
                        <td className="px-4 py-3 text-ink-soft">
                          {item.quantity.toLocaleString('es-ES', { maximumFractionDigits: 1 })} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-ink-soft">
                          {item.min_stock !== null
                            ? `${item.min_stock.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${item.unit}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>
                            <Icon name={st.icon} className="w-3 h-3" />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-soft text-xs">
                          {item.last_movement_at ? formatDate(item.last_movement_at) : 'Sin movimientos'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            onClick={() => {
                              setAdjustDialog(item);
                              setAdjustQty(String(item.quantity));
                              setAdjustNotes('');
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-xs text-warning hover:text-warning hover:bg-warning/10"
                          >
                            <Icon name="edit" className="w-3.5 h-3.5 mr-1" />
                            Ajustar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────── */}
        {/*  TAB 2: RECEPCIONES                                         */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="recepciones" className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Input
                  placeholder="Filtrar por proveedor..."
                  value={recFilterSupplier}
                  onChange={(e) => setRecFilterSupplier(e.target.value)}
                  className="w-48 h-9 text-xs pl-8"
                />
                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-soft-60" />
              </div>
              <Input
                placeholder="Filtrar por lote..."
                value={recFilterLot}
                onChange={(e) => setRecFilterLot(e.target.value)}
                className="w-44 h-9 text-xs"
              />
            </div>
            <Button
              onClick={() => setShowRecForm(true)}
              size="sm"
              className="text-xs"
            >
              <Icon name="plus" className="w-3.5 h-3.5 mr-1" />
              Nueva recepción
            </Button>
          </div>

          {/* Tabla de recepciones */}
          {recLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-cream-dark rounded-lg" />
              ))}
            </div>
          ) : receivings.length === 0 ? (
            <EmptyState
              icon={<Icon name="truck" className="w-6 h-6" />}
              title="Sin recepciones"
              description="No hay registros de recepción. Crea una nueva recepción para comenzar."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-cream-dark bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream text-left text-xs font-semibold text-ink-soft uppercase tracking-wider">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Ingrediente</th>
                    <th className="px-4 py-3">Lote</th>
                    <th className="px-4 py-3">Cantidad</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Caducidad</th>
                    <th className="px-4 py-3">Temp.</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {receivings.map((rec) => (
                    <tr key={rec.id} className="hover:bg-cream/50 transition-colors">
                      <td className="px-4 py-3 text-ink-soft text-xs whitespace-nowrap">
                        {formatDate(rec.received_date)}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {rec.ingredient_name}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-cream-dark px-1.5 py-0.5 rounded text-ink-light font-mono">
                          {rec.lot_number}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {Number(rec.batch_quantity).toLocaleString('es-ES', { maximumFractionDigits: 1 })} {rec.unit}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {rec.supplier || '—'}
                      </td>
                      <td className="px-4 py-3 text-ink-soft text-xs">
                        {rec.expiry_date ? formatDate(rec.expiry_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${rec.temp_alert ? 'text-danger font-medium' : 'text-ink-soft'}`}>
                          {formatTemp(rec.temperature)}
                          {rec.temp_alert && <Icon name="alertTriangle" className="w-3 h-3 inline ml-1" />}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          rec.condition_ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                        }`}>
                          {rec.condition_ok ? 'Aceptado' : 'Rechazado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Diálogo: Formulario de recepción ── */}
          <Dialog open={showRecForm} onOpenChange={setShowRecForm}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Nueva recepción</DialogTitle>
                <DialogDescription>
                  Registra la entrada de mercancía. Puedes escanear el código QR del lote.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Ingrediente con buscador */}
                <div className="relative">
                  <label className="block text-xs font-medium text-ink-soft mb-1">Ingrediente *</label>
                  <Input
                    placeholder="Buscar ingrediente..."
                    value={ingredientSearch}
                    onChange={(e) => {
                      setIngredientSearch(e.target.value);
                      setShowIngDropdown(true);
                      setRecForm((prev) => ({ ...prev, ingredient_id: '', ingredient_name: '' }));
                    }}
                    onFocus={() => ingredientSearch.length >= 2 && setShowIngDropdown(true)}
                    className="text-sm"
                  />
                  {ingredientOptions.length > 0 && showIngDropdown && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white border border-cream-dark rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {ingredientOptions.map((ing) => (
                        <button
                          key={ing.id}
                          onClick={() => selectIngredient(ing)}
                          className="w-full text-left px-3 py-2 hover:bg-warning/10 text-sm transition-colors"
                        >
                          <span className="font-medium">{ing.name}</span>
                          <span className="text-ink-soft-60 ml-2 text-xs">({ing.unit})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lote y cantidad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-1">Nº de lote *</label>
                    <Input
                      placeholder="Ej: LOTE-2025-001"
                      value={recForm.lot_number}
                      onChange={(e) => setRecForm((prev) => ({ ...prev, lot_number: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-1">Cantidad *</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0"
                        value={recForm.batch_quantity}
                        onChange={(e) => setRecForm((prev) => ({ ...prev, batch_quantity: e.target.value }))}
                        className="text-sm flex-1"
                      />
                      <span className="text-xs text-ink-soft-60 self-center">{recForm.unit}</span>
                    </div>
                  </div>
                </div>

                {/* Proveedor y responsable */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-1">Proveedor</label>
                    <Input
                      placeholder="Nombre del proveedor"
                      value={recForm.supplier}
                      onChange={(e) => setRecForm((prev) => ({ ...prev, supplier: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-1">Recibido por</label>
                    <Input
                      placeholder="Nombre del responsable"
                      value={recForm.received_by}
                      onChange={(e) => setRecForm((prev) => ({ ...prev, received_by: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Fecha caducidad y temperatura */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-1">Fecha de caducidad</label>
                    <Input
                      type="date"
                      value={recForm.expiry_date}
                      onChange={(e) => setRecForm((prev) => ({ ...prev, expiry_date: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-1">Temperatura (°C)</label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Ej: 4.0"
                      value={recForm.temperature}
                      onChange={(e) => setRecForm((prev) => ({ ...prev, temperature: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* QR Code */}
                <div>
                  <label className="block text-xs font-medium text-ink-soft mb-1">Código QR</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Código escaneado o manual"
                      value={recForm.qr_code}
                      onChange={(e) => setRecForm((prev) => ({ ...prev, qr_code: e.target.value }))}
                      className="text-sm flex-1"
                    />
                    <Button
                      onClick={() => setShowQrScanner(true)}
                      variant="outline"
                      size="sm"
                      className="text-xs whitespace-nowrap"
                    >
                      <Icon name="search" className="w-3.5 h-3.5 mr-1" />
                    </Button>
                  </div>
                  {showQrScanner && (
                    <div className="mt-2">
                      <QrScanner
                        onScan={handleQrScan}
                        onClose={() => setShowQrScanner(false)}
                      />
                    </div>
                  )}
                  {scanNotice && (
                    <p className={`text-xs mt-1.5 ${scanNotice.startsWith('✓') ? 'text-success' : 'text-warning'}`}>
                      {scanNotice}
                    </p>
                  )}
                </div>

                {/* Estado y notas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-soft mb-2">Estado</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="condition"
                          checked={recForm.condition_ok}
                          onChange={() => setRecForm((prev) => ({ ...prev, condition_ok: true }))}
                          className="text-warning accent-amber-600"
                        />
                        Aceptado
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="condition"
                          checked={!recForm.condition_ok}
                          onChange={() => setRecForm((prev) => ({ ...prev, condition_ok: false }))}
                          className="text-danger accent-red-500"
                        />
                        Rechazado
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-soft mb-1">Notas</label>
                  <textarea
                    placeholder="Observaciones adicionales..."
                    value={recForm.notes}
                    onChange={(e) => setRecForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-cream-dark rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowRecForm(false)}
                  size="sm"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitReception}
                  disabled={recFormLoading}
                  size="sm"
                >
                  {recFormLoading ? (
                    <><Icon name="spinner" className="w-3.5 h-3.5 mr-1.5 animate-spin" />Guardando...</>
                  ) : (
                    'Registrar recepción'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────── */}
        {/*  TAB 3: LOTES POR EVENTO                                    */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="lotes" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1 w-full sm:w-auto">
              <Select value={selectedEventLot} onValueChange={setSelectedEventLot}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Selecciona un evento..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.client_name} — {ev.event_date ? formatDate(ev.event_date) : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selectedEventLot && (
            <EmptyState
              icon={<Icon name="layers" className="w-6 h-6" />}
              title="Selecciona un evento"
              description="Elige un evento para ver los lotes de ingredientes consumidos."
            />
          )}

          {lotLoading && (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-cream-dark rounded-lg" />
              ))}
            </div>
          )}

          {selectedEventLot && !lotLoading && lotEventInfo && (
            <div className="bg-warning/10 rounded-xl px-4 py-3 border border-amber-200 mb-3">
              <p className="text-sm font-medium text-warning">
                {lotEventInfo.client_name}
              </p>
              <p className="text-xs text-warning">
                {lotEventInfo.event_date ? formatDate(lotEventInfo.event_date) : ''} · {lotEventInfo.status}
              </p>
            </div>
          )}

          {selectedEventLot && !lotLoading && lotConsumption.length === 0 && (
            <EmptyState
              icon={<Icon name="package" className="w-6 h-6" />}
              title="Sin consumo de lotes"
              description="Este evento no tiene lotes de ingredientes consumidos registrados."
            />
          )}

          {selectedEventLot && !lotLoading && lotConsumption.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-cream-dark bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream text-left text-xs font-semibold text-ink-soft uppercase tracking-wider">
                    <th className="px-4 py-3">Ingrediente</th>
                    <th className="px-4 py-3">Lote</th>
                    <th className="px-4 py-3">Consumido</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Caducidad</th>
                    <th className="px-4 py-3">Temp.</th>
                    <th className="px-4 py-3">Consumido el</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {lotConsumption.map((lot) => (
                    <tr key={lot.id} className="hover:bg-cream/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">
                        {lot.ingredient_name}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-cream-dark px-1.5 py-0.5 rounded text-ink-light font-mono">
                          {lot.lot_number}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {lot.quantity_consumed.toLocaleString('es-ES', { maximumFractionDigits: 1 })} {lot.unit}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {lot.supplier || '—'}
                      </td>
                      <td className="px-4 py-3 text-ink-soft text-xs">
                        {lot.expiry_date ? formatDate(lot.expiry_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${lot.temperature !== null && lot.temperature > 8 ? 'text-danger font-medium' : 'text-ink-soft'}`}>
                          {formatTemp(lot.temperature)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-soft text-xs whitespace-nowrap">
                        {formatDate(lot.consumed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────── */}
        {/*  TAB 4: INFORME APPCC                                       */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="appcc" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1 w-full sm:w-auto">
              <Select value={selectedEventAppcc} onValueChange={setSelectedEventAppcc}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Selecciona un evento..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.client_name} — {ev.event_date ? formatDate(ev.event_date) : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selectedEventAppcc && (
            <EmptyState
              icon={<Icon name="clipboardCheck" className="w-6 h-6" />}
              title="Selecciona un evento"
              description="Elige un evento para generar el informe APPCC completo."
            />
          )}

          {appccLoading && (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-cream-dark rounded-lg" />
              ))}
            </div>
          )}

          {selectedEventAppcc && !appccLoading && appccData && (
            <div className="space-y-6">
              {/* Cabecera del evento */}
              <div className="bg-warning/10 rounded-xl p-4 border border-amber-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-warning text-lg">
                      {appccData.event.client_name}
                    </h3>
                    <p className="text-sm text-warning mt-1">
                      {appccData.event.event_date ? formatDate(appccData.event.event_date) : ''}
                      {appccData.event.event_type ? ` · ${appccData.event.event_type}` : ''}
                      {appccData.event.guest_count ? ` · ${appccData.event.guest_count} invitados` : ''}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    appccData.event.status === 'confirmed' ? 'bg-success/10 text-success' :
                    appccData.event.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-cream-dark text-ink-soft'
                  }`}>
                    {appccData.event.status}
                  </span>
                </div>
              </div>

              {/* Alertas */}
              {appccData.alerts.temperature && (
                <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 flex items-center gap-2">
                  <Icon name="alertTriangle" className="w-5 h-5 text-danger flex-shrink-0" />
                  <p className="text-sm text-danger">{appccData.alerts.temperature}</p>
                </div>
              )}

              {/* Trazabilidad detallada */}
              {appccData.trace.length === 0 ? (
                <EmptyState
                  icon={<Icon name="package" className="w-6 h-6" />}
                  title="Sin datos de trazabilidad"
                  description="No hay ingredientes con trazabilidad registrada para este evento."
                />
              ) : (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-ink-light">
                    Trazabilidad completa ({appccData.trace.length} registro{appccData.trace.length !== 1 ? 's' : ''})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-cream-dark bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-cream text-left text-xs font-semibold text-ink-soft uppercase tracking-wider">
                          <th className="px-4 py-3">Ingrediente</th>
                          <th className="px-4 py-3">Cantidad</th>
                          <th className="px-4 py-3">Lote</th>
                          <th className="px-4 py-3">Proveedor</th>
                          <th className="px-4 py-3">Recibido</th>
                          <th className="px-4 py-3">Caducidad</th>
                          <th className="px-4 py-3">Temp.</th>
                          <th className="px-4 py-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {appccData.trace.map((item) => {
                          const hasLotData = item.lot_number !== null;
                          return (
                            <tr key={item.shopping_item_id} className={`hover:bg-cream/50 transition-colors ${item.temp_alert ? 'bg-danger/10/50' : ''}`}>
                              <td className="px-4 py-3 font-medium text-ink">
                                {item.ingredient_name}
                              </td>
                              <td className="px-4 py-3 text-ink-soft">
                                {item.total_grams
                                  ? `${Number(item.total_grams).toLocaleString('es-ES', { maximumFractionDigits: 1 })}g`
                                  : item.total_units
                                  ? `${Number(item.total_units).toLocaleString('es-ES', { maximumFractionDigits: 1 })} uds`
                                  : item.total_ml
                                  ? `${Number(item.total_ml).toLocaleString('es-ES', { maximumFractionDigits: 1 })}ml`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3">
                                {hasLotData ? (
                                  <code className="text-xs bg-cream-dark px-1.5 py-0.5 rounded text-ink-light font-mono">
                                    {item.lot_number}
                                  </code>
                                ) : (
                                  <span className="text-ink-soft-60 italic text-xs">Sin asignar</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-ink-soft">
                                {item.supplier || item.shopping_provider || '—'}
                              </td>
                              <td className="px-4 py-3 text-ink-soft text-xs whitespace-nowrap">
                                {item.received_date ? formatDate(item.received_date) : '—'}
                              </td>
                              <td className="px-4 py-3 text-ink-soft text-xs whitespace-nowrap">
                                {item.expiry_date ? formatDate(item.expiry_date) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs ${item.temp_alert ? 'text-danger font-medium' : 'text-ink-soft'}`}>
                                  {formatTemp(item.temperature)}
                                  {item.temp_alert && <Icon name="alertTriangle" className="w-3 h-3 inline ml-1" />}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {item.completed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                                    <Icon name="check" className="w-3 h-3" />
                                    Completo
                                  </span>
                                ) : (
                                  <span className="text-ink-soft-60 text-xs">Pendiente</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resumen */}
              <div className="bg-success/10 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="check-circle" className="w-5 h-5 text-success" />
                  <h3 className="font-semibold text-success">Resumen APPCC</h3>
                </div>
                <p className="text-sm text-success">
                  {appccData.trace.length} ingrediente{appccData.trace.length !== 1 ? 's' : ''} ·{' '}
                  {appccData.trace.filter((t) => t.completed).length} completo{appccData.trace.filter((t) => t.completed).length !== 1 ? 's' : ''} ·{' '}
                  {appccData.trace.filter((t) => t.temp_alert).length} alerta{appccData.trace.filter((t) => t.temp_alert).length !== 1 ? 's' : ''} de temperatura
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────── */}
        {/*  TAB 5: TRAZABILIDAD POR LOTE                             */}
        {/* ─────────────────────────────────────────────────────────── */}
        <TabsContent value="lot-trace" className="space-y-4">
          {/* Selector de lote */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1 w-full sm:w-auto">
              <Select value={selectedLotId} onValueChange={setSelectedLotId}>
                <SelectTrigger className="w-full sm:w-96">
                  <SelectValue placeholder="Selecciona un lote..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredLots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.lot_number} — {lot.ingredient_name}
                      {lot.supplier ? ` (${lot.supplier})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-full sm:w-48">
              <Input
                placeholder="Buscar lote..."
                value={lotFilterSearch}
                onChange={(e) => setLotFilterSearch(e.target.value)}
                className="h-9 text-xs pl-8"
              />
              <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-soft-60" />
            </div>
          </div>

          {!selectedLotId && (
            <EmptyState
              icon={<Icon name="search" className="w-6 h-6" />}
              title="Selecciona un lote"
              description="Elige un lote para ver su trazabilidad completa: proveedor, recepción APPCC y eventos donde fue consumido."
            />
          )}

          {lotTraceLoading && (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-cream-dark rounded-lg" />
              ))}
            </div>
          )}

          {selectedLotId && !lotTraceLoading && lotTraceData && (
            <div className="space-y-6">
              {/* Cabecera del lote */}
              <div className="bg-warning/10 rounded-xl p-4 border border-amber-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-warning text-lg">
                      Lote: {lotTraceData.lot.lot_number}
                    </h3>
                    <p className="text-sm text-warning mt-1">
                      {lotTraceData.lot.ingredient.name}
                      {lotTraceData.lot.supplier ? ` · Proveedor: ${lotTraceData.lot.supplier}` : ''}
                    </p>
                  </div>
                  <Button
                    onClick={generateLotPdf}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Icon name="download" className="w-3.5 h-3.5 mr-1.5" />
                    Exportar PDF
                  </Button>
                </div>
              </div>

              {/* Alertas */}
              {(lotTraceData.alerts.temperature || lotTraceData.alerts.expiry) && (
                <div className="space-y-2">
                  {lotTraceData.alerts.temperature && (
                    <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 flex items-center gap-2">
                      <Icon name="alertTriangle" className="w-5 h-5 text-danger flex-shrink-0" />
                      <p className="text-sm text-danger">{lotTraceData.alerts.temperature}</p>
                    </div>
                  )}
                  {lotTraceData.alerts.expiry && (
                    <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 flex items-center gap-2">
                      <Icon name="alertTriangle" className="w-5 h-5 text-danger flex-shrink-0" />
                      <p className="text-sm text-danger">{lotTraceData.alerts.expiry}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Datos del lote */}
              <div className="bg-white rounded-xl border border-cream-dark p-4">
                <h4 className="text-sm font-semibold text-ink mb-3">Datos de Recepción</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-ink-soft text-xs">Ingrediente</span>
                    <p className="font-medium text-ink">{lotTraceData.lot.ingredient.name}</p>
                  </div>
                  <div>
                    <span className="text-ink-soft text-xs">Categoría</span>
                    <p className="font-medium text-ink">{lotTraceData.lot.ingredient.category || '—'}</p>
                  </div>
                  <div>
                    <span className="text-ink-soft text-xs">Proveedor</span>
                    <p className="font-medium text-ink">{lotTraceData.lot.supplier || '—'}</p>
                  </div>
                  <div>
                    <span className="text-ink-soft text-xs">Fecha de recepción</span>
                    <p className="font-medium text-ink">{lotTraceData.lot.received_date ? formatDate(lotTraceData.lot.received_date) : '—'}</p>
                  </div>
                  <div>
                    <span className="text-ink-soft text-xs">Recibido por</span>
                    <p className="font-medium text-ink">{lotTraceData.lot.received_by || '—'}</p>
                  </div>
                  <div>
                    <span className="text-ink-soft text-xs">Temperatura</span>
                    <p className={`font-medium ${lotTraceData.lot.temperature !== null && lotTraceData.lot.temperature > 8 ? 'text-danger' : 'text-ink'}`}>
                      {formatTemp(lotTraceData.lot.temperature)}
                    </p>
                  </div>
                  <div>
                    <span className="text-ink-soft text-xs">Caducidad</span>
                    <p className={`font-medium ${lotTraceData.alerts.expiry ? 'text-danger' : 'text-ink'}`}>
                      {lotTraceData.lot.expiry_date ? formatDate(lotTraceData.lot.expiry_date) : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-ink-soft text-xs">Estado</span>
                    <p className="font-medium text-ink">
                      {lotTraceData.lot.condition_ok ? (
                        <span className="text-success">Aceptado</span>
                      ) : (
                        <span className="text-danger">Rechazado</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-ink-soft text-xs">Código QR</span>
                    <p className="font-medium text-ink font-mono text-xs">{lotTraceData.lot.qr_code || '—'}</p>
                  </div>
                  {lotTraceData.lot.notes && (
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-ink-soft text-xs">Notas</span>
                      <p className="font-medium text-ink">{lotTraceData.lot.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Resumen de consumo */}
              <div className="bg-success/10 rounded-xl p-4 border border-green-200">
                <h4 className="text-sm font-semibold text-success mb-2">Resumen de Consumo</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-success/70 text-xs">Recibido</span>
                    <p className="font-bold text-success text-lg">
                      {lotTraceData.summary.total_received.toLocaleString('es-ES')} {lotTraceData.summary.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-success/70 text-xs">Consumido</span>
                    <p className="font-bold text-success text-lg">
                      {lotTraceData.summary.total_consumed.toLocaleString('es-ES')} {lotTraceData.summary.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-success/70 text-xs">Restante</span>
                    <p className="font-bold text-success text-lg">
                      {lotTraceData.summary.remaining.toLocaleString('es-ES')} {lotTraceData.summary.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-success/70 text-xs">Eventos</span>
                    <p className="font-bold text-success text-lg">
                      {lotTraceData.summary.consumption_count}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detalle de consumos por evento */}
              {lotTraceData.consumptions.length === 0 ? (
                <EmptyState
                  icon={<Icon name="package" className="w-6 h-6" />}
                  title="Sin consumos registrados"
                  description="Este lote aún no ha sido consumido en ningún evento."
                />
              ) : (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-ink-light">
                    Consumos por Evento ({lotTraceData.consumptions.length})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-cream-dark bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-cream text-left text-xs font-semibold text-ink-soft uppercase tracking-wider">
                          <th className="px-4 py-3">Fecha consumo</th>
                          <th className="px-4 py-3">Evento</th>
                          <th className="px-4 py-3">Fecha evento</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3">Pax</th>
                          <th className="px-4 py-3">Cantidad</th>
                          <th className="px-4 py-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {lotTraceData.consumptions.map((c) => (
                          <tr key={c.consumption_id} className="hover:bg-cream/50 transition-colors">
                            <td className="px-4 py-3 text-ink-soft text-xs whitespace-nowrap">
                              {formatDate(c.consumed_at)}
                            </td>
                            <td className="px-4 py-3 font-medium text-ink">
                              {c.event.client_name}
                            </td>
                            <td className="px-4 py-3 text-ink-soft text-xs whitespace-nowrap">
                              {c.event.event_date ? formatDate(c.event.event_date) : '—'}
                            </td>
                            <td className="px-4 py-3 text-ink-soft">
                              {c.event.event_type || '—'}
                            </td>
                            <td className="px-4 py-3 text-ink-soft">
                              {c.event.guest_count || '—'}
                            </td>
                            <td className="px-4 py-3 text-ink-soft">
                              {c.quantity_consumed.toLocaleString('es-ES', { maximumFractionDigits: 1 })} {c.unit}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                c.event.status === 'completed' ? 'bg-success/10 text-success' :
                                c.event.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-cream-dark text-ink-soft'
                              }`}>
                                {c.event.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Diálogo: Ajuste de stock ── */}
      <Dialog open={adjustDialog !== null} onOpenChange={(open) => { if (!open) setAdjustDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Ajustar stock: {adjustDialog?.ingredient_name}
            </DialogTitle>
            <DialogDescription>
              Introduce la nueva cantidad. Se registrará un movimiento de ajuste.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">
                Nueva cantidad ({adjustDialog?.unit})
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">
                Motivo del ajuste
              </label>
              <textarea
                placeholder="Ej: Inventario físico, merma, etc."
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-cream-dark rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>
            {adjustDialog && (
              <div className="text-xs text-ink-soft">
                Stock actual: {adjustDialog.quantity.toLocaleString('es-ES', { maximumFractionDigits: 1 })} {adjustDialog.unit}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)} size="sm">
              Cancelar
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={loading}
              size="sm"
              >
              {loading ? (
                <><Icon name="spinner" className="w-3.5 h-3.5 mr-1.5 animate-spin" />Guardando...</>
              ) : (
                'Guardar ajuste'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}