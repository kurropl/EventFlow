'use client';
/**
 * EventFlow — Automation Rules Panel
 *
 * Tab within WebhooksPanel for managing automation rules that trigger
 * on webhook events. Includes rule CRUD, execution logs, and toggling.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// Types
// ============================================================

interface AutomationCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: unknown;
}

interface AutomationAction {
  type: 'update_event_status' | 'send_notification' | 'forward_webhook' | 'log_message' | 'update_event_field';
  config: Record<string, unknown>;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_topic: string;
  match_type: 'all' | 'any';
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  cooldown_minutes: number;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

interface AutomationLog {
  id: string;
  rule_id: string;
  rule_name: string;
  event_id: string | null;
  topic: string;
  conditions_met: boolean;
  actions_taken: AutomationAction[];
  success: boolean;
  error_message: string | null;
  execution_ms: number;
  created_at: string;
}

// ============================================================
// Constants
// ============================================================

const TOPICS: { topic: string; label: string }[] = [
  { topic: 'BUDGET_CREATED', label: 'Presupuesto creado' },
  { topic: 'BUDGET_SENT', label: 'Presupuesto enviado' },
  { topic: 'STATUS_CHANGED', label: 'Cambio de estado' },
  { topic: 'BUDGET_CONFIRMED', label: 'Presupuesto confirmado' },
  { topic: 'BUDGET_CANCELLED', label: 'Presupuesto cancelado' },
];

const OPERATORS: { value: AutomationCondition['operator']; label: string }[] = [
  { value: 'eq', label: 'es igual a' },
  { value: 'ne', label: 'no es igual a' },
  { value: 'gt', label: 'mayor que' },
  { value: 'gte', label: 'mayor o igual que' },
  { value: 'lt', label: 'menor que' },
  { value: 'lte', label: 'menor o igual que' },
  { value: 'contains', label: 'contiene' },
  { value: 'in', label: 'está en' },
];

const ACTION_TYPES: { value: AutomationAction['type']; label: string; fields: { key: string; label: string; type: string; options?: string[] }[] }[] = [
  {
    value: 'log_message',
    label: 'Registrar mensaje',
    fields: [{ key: 'message', label: 'Mensaje', type: 'text' }],
  },
  {
    value: 'update_event_status',
    label: 'Cambiar estado del evento',
    fields: [{
      key: 'status',
      label: 'Nuevo estado',
      type: 'select',
      options: ['draft', 'sent', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled'],
    }],
  },
  {
    value: 'update_event_field',
    label: 'Actualizar campo del evento',
    fields: [
      { key: 'field', label: 'Nombre del campo', type: 'text' },
      { key: 'value', label: 'Valor', type: 'text' },
    ],
  },
  {
    value: 'send_notification',
    label: 'Enviar notificación',
    fields: [
      { key: 'channel', label: 'Canal', type: 'select', options: ['console', 'email', 'whatsapp'] },
      { key: 'message', label: 'Mensaje', type: 'text' },
    ],
  },
  {
    value: 'forward_webhook',
    label: 'Reenviar webhook',
    fields: [{ key: 'url', label: 'URL destino', type: 'text' }],
  },
];

const EMPTY_RULE: AutomationRule = {
  id: '',
  name: '',
  description: '',
  enabled: true,
  trigger_topic: 'BUDGET_CREATED',
  match_type: 'all',
  conditions: [],
  actions: [],
  cooldown_minutes: 0,
  last_triggered_at: null,
  trigger_count: 0,
  created_at: '',
  updated_at: '',
};

// ============================================================
// Helper Components
// ============================================================

function LoadingSpinner({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-6 w-6' : 'h-8 w-8';
  return (
    <svg className={`animate-spin ${s} text-[#A88A3A]`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function RuleConditionEditor({
  conditions,
  matchType,
  onChange,
}: {
  conditions: AutomationCondition[];
  matchType: 'all' | 'any';
  onChange: (conditions: AutomationCondition[], matchType: 'all' | 'any') => void;
}) {
  const addCondition = () => {
    onChange(
      [...conditions, { field: 'event.total_pvp', operator: 'gt', value: 0 }],
      matchType
    );
  };

  const removeCondition = (idx: number) => {
    const next = conditions.filter((_, i) => i !== idx);
    onChange(next, matchType);
  };

  const updateCondition = (idx: number, field: string, value: unknown) => {
    const next = [...conditions];
    (next[idx] as unknown as Record<string, unknown>)[field] = value;
    onChange(next, matchType);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#6B7280]">Coincidir:</span>
        <button
          onClick={() => onChange(conditions, 'all')}
          className={`px-3 py-1 text-xs rounded-lg border transition-all ${
            matchType === 'all'
              ? 'bg-[#FBF6E9] border-[#D9920B] text-[#A88A3A]'
              : 'bg-white border-[#ECECF1] text-[#6B7280] hover:border-[#D4D4D9]'
          }`}
        >
          TODAS las condiciones
        </button>
        <button
          onClick={() => onChange(conditions, 'any')}
          className={`px-3 py-1 text-xs rounded-lg border transition-all ${
            matchType === 'any'
              ? 'bg-[#FBF6E9] border-[#D9920B] text-[#A88A3A]'
              : 'bg-white border-[#ECECF1] text-[#6B7280] hover:border-[#D4D4D9]'
          }`}
        >
          CUALQUIER condición
        </button>
      </div>

      {conditions.length === 0 && (
        <p className="text-xs text-[#9CA3AF] italic">Sin condiciones — la regla se disparará siempre.</p>
      )}

      {conditions.map((cond, idx) => (
        <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-[#FAFAFC] border border-[#F2F2F5]">
          <span className="text-[10px] font-mono text-[#6B7280] bg-white px-2 py-0.5 rounded border border-[#ECECF1]">
            #{idx + 1}
          </span>
          <select
            value={cond.field}
            onChange={(e) => updateCondition(idx, 'field', e.target.value)}
            className="text-xs bg-white border border-[#ECECF1] rounded-lg px-2 py-1.5 text-[#1A1A1A] flex-1 min-w-0"
          >
            <optgroup label="Campos del evento">
              <option value="event.total_pvp">total_pvp</option>
              <option value="event.total_cost">total_cost</option>
              <option value="event.guest_count">guest_count</option>
              <option value="event.status">status</option>
              <option value="event.event_type">event_type</option>
              <option value="event.profit">profit</option>
              <option value="event.margin_pct">margin_pct</option>
            </optgroup>
            <optgroup label="Metadatos">
              <option value="topic">topic</option>
              <option value="timestamp">timestamp</option>
            </optgroup>
          </select>
          <select
            value={cond.operator}
            onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
            className="text-xs bg-white border border-[#ECECF1] rounded-lg px-2 py-1.5 text-[#1A1A1A]"
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          {cond.operator === 'in' ? (
            <input
              value={Array.isArray(cond.value) ? cond.value.join(',') : String(cond.value ?? '')}
              onChange={(e) => updateCondition(idx, 'value', e.target.value.split(',').map((s) => s.trim()))}
              placeholder="val1,val2,..."
              className="text-xs bg-white border border-[#ECECF1] rounded-lg px-2 py-1.5 text-[#1A1A1A] flex-1 min-w-0"
            />
          ) : (
            <input
              value={String(cond.value ?? '')}
              onChange={(e) => updateCondition(idx, 'value', e.target.value)}
              placeholder="Valor"
              className="text-xs bg-white border border-[#ECECF1] rounded-lg px-2 py-1.5 text-[#1A1A1A] flex-1 min-w-0"
            />
          )}
          <button
            onClick={() => removeCondition(idx)}
            className="text-[#9CA3AF] hover:text-[#DC2626] p-1 rounded transition-colors"
            title="Eliminar condición"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      <button
        onClick={addCondition}
        className="flex items-center gap-1.5 text-xs text-[#A88A3A] hover:text-[#C9A84C] transition-colors font-medium"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Añadir condición
      </button>
    </div>
  );
}

function RuleActionEditor({
  actions,
  onChange,
}: {
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
}) {
  const addAction = () => {
    onChange([...actions, { type: 'log_message', config: { message: '' } }]);
  };

  const removeAction = (idx: number) => {
    onChange(actions.filter((_, i) => i !== idx));
  };

  const updateActionType = (idx: number, type: AutomationAction['type']) => {
    const actionDef = ACTION_TYPES.find((a) => a.value === type);
    const config: Record<string, unknown> = {};
    if (actionDef) {
      for (const f of actionDef.fields) {
        config[f.key] = '';
      }
    }
    const next = [...actions];
    next[idx] = { type, config };
    onChange(next);
  };

  const updateConfig = (idx: number, key: string, value: unknown) => {
    const next = [...actions];
    next[idx] = {
      ...next[idx],
      config: { ...next[idx].config, [key]: value },
    };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {actions.length === 0 && (
        <p className="text-xs text-[#9CA3AF] italic">Sin acciones definidas.</p>
      )}

      {actions.map((action, idx) => {
        const actionDef = ACTION_TYPES.find((a) => a.value === action.type);
        return (
          <div key={idx} className="p-3 rounded-xl bg-[#FAFAFC] border border-[#F2F2F5] space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#6B7280] bg-white px-2 py-0.5 rounded border border-[#ECECF1]">
                #{idx + 1}
              </span>
              <select
                value={action.type}
                onChange={(e) => updateActionType(idx, e.target.value as AutomationAction['type'])}
                className="text-xs bg-white border border-[#ECECF1] rounded-lg px-2 py-1.5 text-[#1A1A1A] flex-1 min-w-0"
              >
                {ACTION_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>
              <button
                onClick={() => removeAction(idx)}
                className="text-[#9CA3AF] hover:text-[#DC2626] p-1 rounded transition-colors"
                title="Eliminar acción"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {actionDef && actionDef.fields.length > 0 && (
              <div className="pl-6 space-y-2">
                {actionDef.fields.map((field) => (
                  <div key={field.key} className="flex items-center gap-2">
                    <label className="text-xs text-[#6B7280] min-w-[80px]">{field.label}</label>
                    {field.type === 'select' && field.options ? (
                      <select
                        value={String(action.config[field.key] ?? '')}
                        onChange={(e) => updateConfig(idx, field.key, e.target.value)}
                        className="text-xs bg-white border border-[#ECECF1] rounded-lg px-2 py-1.5 text-[#1A1A1A] flex-1"
                      >
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={String(action.config[field.key] ?? '')}
                        onChange={(e) => updateConfig(idx, field.key, e.target.value)}
                        placeholder={field.label}
                        className="text-xs bg-white border border-[#ECECF1] rounded-lg px-2 py-1.5 text-[#1A1A1A] flex-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addAction}
        className="flex items-center gap-1.5 text-xs text-[#A88A3A] hover:text-[#C9A84C] transition-colors font-medium"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Añadir acción
      </button>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function AutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'logs'>('list');
  const [editingRule, setEditingRule] = useState<AutomationRule>(EMPTY_RULE);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/automation-rules');
      const json = await res.json();
      if (json.success) {
        setRules(json.data);
      } else {
        setError(json.error ?? 'Error al cargar reglas');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    }
  }, []);

  const fetchLogs = useCallback(async (ruleId?: string) => {
    try {
      const params = new URLSearchParams({ scope: 'logs', limit: '30' });
      if (ruleId) params.set('ruleId', ruleId);
      const res = await fetch(`/api/automation-rules?${params}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch {
      // Silently fail for logs
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchRules(), fetchLogs()]);
      setLoading(false);
    })();
  }, [fetchRules, fetchLogs]);

  const handleToggle = async (rule: AutomationRule) => {
    setToggling(rule.id);
    try {
      const res = await fetch(`/api/automation-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const json = await res.json();
      if (json.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
        );
      }
    } catch {
      // Swallow
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('¿Eliminar esta regla permanentemente?')) return;
    try {
      setError(null);
      const res = await fetch(`/api/automation-rules/${ruleId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
      } else {
        setError(json.error ?? 'Error al eliminar');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    }
  };

  const handleSave = async () => {
    if (!editingRule.name || editingRule.name.trim().length < 2) {
      setSaveResult({ ok: false, msg: 'El nombre debe tener al menos 2 caracteres' });
      return;
    }

    setSaving(true);
    setSaveResult(null);
    try {
      const isNew = !editingRule.id;
      const url = isNew ? '/api/automation-rules' : `/api/automation-rules/${editingRule.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingRule.name.trim(),
          description: editingRule.description.trim(),
          trigger_topic: editingRule.trigger_topic,
          match_type: editingRule.match_type,
          conditions: editingRule.conditions,
          actions: editingRule.actions,
          cooldown_minutes: editingRule.cooldown_minutes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSaveResult({ ok: true, msg: isNew ? 'Regla creada correctamente' : 'Regla actualizada correctamente' });
        await fetchRules();
        setTimeout(() => {
          setView('list');
          setSaveResult(null);
        }, 1200);
      } else {
        setSaveResult({ ok: false, msg: json.error ?? 'Error al guardar' });
      }
    } catch (e) {
      setSaveResult({ ok: false, msg: e instanceof Error ? e.message : 'Error de conexión' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (rule?: AutomationRule) => {
    setEditingRule(rule ? { ...rule } : { ...EMPTY_RULE });
    setSaveResult(null);
    setView(rule ? 'edit' : 'create');
  };

  // ============================================================
  // Render: Rule Card
  // ============================================================

  const ruleCard = (rule: AutomationRule) => (
    <motion.div
      key={rule.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#ECECF1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-[#1A1A1A] truncate">{rule.name}</h4>
            <span className="text-[10px] font-mono bg-[#FBF6E9] text-[#A88A3A] px-2 py-0.5 rounded whitespace-nowrap">
              {rule.trigger_topic}
            </span>
          </div>
          {rule.description && (
            <p className="text-xs text-[#6B7280] mb-2 line-clamp-2">{rule.description}</p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-[#9CA3AF]">
            <span>{rule.conditions.length} condición(es)</span>
            <span>{rule.actions.length} acción(es)</span>
            <span>Disparada: {rule.trigger_count} vez(es)</span>
            {rule.last_triggered_at && (
              <span>Última: {new Date(rule.last_triggered_at).toLocaleString('es-ES')}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => startEdit(rule)}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#A88A3A] hover:bg-[#FBF6E9] transition-all"
            title="Editar regla"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(rule.id)}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF3F3] transition-all"
            title="Eliminar regla"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <label className="relative inline-flex items-center cursor-pointer ml-1">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={() => handleToggle(rule)}
              disabled={toggling === rule.id}
              className="sr-only peer"
            />
            <div className={`w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
              rule.enabled
                ? 'bg-[#A88A3A]'
                : 'bg-[#D4D4D9]'
            }`} />
          </label>
        </div>
      </div>
    </motion.div>
  );

  // ============================================================
  // Render: Rule Form (create/edit)
  // ============================================================

  const ruleForm = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1A1A1A]">
          {view === 'create' ? 'Nueva regla de automatización' : 'Editar regla'}
        </h3>
        <button
          onClick={() => { setView('list'); setSaveResult(null); }}
          className="text-xs text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
        >
          ← Volver
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Nombre *</label>
        <input
          value={editingRule.name}
          onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
          placeholder="Ej: Notificar pedidos grandes"
          className="w-full text-sm bg-white border border-[#ECECF1] rounded-xl px-3.5 py-2.5 text-[#1A1A1A] placeholder:text-[#B0B0B8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Descripción</label>
        <textarea
          value={editingRule.description}
          onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
          placeholder="Describe cuándo y por qué se dispara esta regla..."
          rows={2}
          className="w-full text-sm bg-white border border-[#ECECF1] rounded-xl px-3.5 py-2.5 text-[#1A1A1A] placeholder:text-[#B0B0B8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all resize-none"
        />
      </div>

      {/* Trigger topic */}
      <div>
        <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Evento disparador *</label>
        <select
          value={editingRule.trigger_topic}
          onChange={(e) => setEditingRule({ ...editingRule, trigger_topic: e.target.value })}
          className="w-full text-sm bg-white border border-[#ECECF1] rounded-xl px-3.5 py-2.5 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
        >
          {TOPICS.map((t) => (
            <option key={t.topic} value={t.topic}>{t.label} ({t.topic})</option>
          ))}
        </select>
      </div>

      {/* Cooldown */}
      <div>
        <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Cooldown (minutos)</label>
        <input
          type="number"
          min={0}
          max={1440}
          value={editingRule.cooldown_minutes}
          onChange={(e) => setEditingRule({ ...editingRule, cooldown_minutes: parseInt(e.target.value) || 0 })}
          className="w-24 text-sm bg-white border border-[#ECECF1] rounded-xl px-3.5 py-2.5 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
        />
        <p className="text-[11px] text-[#9CA3AF] mt-1">Tiempo mínimo entre ejecuciones. 0 = sin límite.</p>
      </div>

      {/* Conditions */}
      <div>
        <h4 className="text-xs font-semibold text-[#1A1A1A] mb-2">Condiciones</h4>
        <RuleConditionEditor
          conditions={editingRule.conditions}
          matchType={editingRule.match_type}
          onChange={(conditions, matchType) =>
            setEditingRule({ ...editingRule, conditions, match_type: matchType })
          }
        />
      </div>

      {/* Actions */}
      <div>
        <h4 className="text-xs font-semibold text-[#1A1A1A] mb-2">Acciones</h4>
        <RuleActionEditor
          actions={editingRule.actions}
          onChange={(actions) => setEditingRule({ ...editingRule, actions })}
        />
      </div>

      {/* Status / result */}
      {saveResult && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-sm rounded-xl px-4 py-3 border ${
            saveResult.ok
              ? 'bg-[#EFFAF2] border-[#CDEBD6] text-[#16A34A]'
              : 'bg-[#FEF3F3] border-[#F6D6D6] text-[#DC2626]'
          }`}
        >
          {saveResult.msg}
        </motion.div>
      )}

      {/* Submit */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
        >
          {saving && <LoadingSpinner />}
          {saving ? 'Guardando...' : view === 'create' ? 'Crear regla' : 'Guardar cambios'}
        </button>
        <button
          onClick={() => { setView('list'); setSaveResult(null); }}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] bg-white border border-[#ECECF1] hover:bg-[#F5F5F8] transition-all"
        >
          Cancelar
        </button>
      </div>
    </div>
  );

  // ============================================================
  // Render: Logs
  // ============================================================

  const logsView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1A1A1A]">Historial de ejecución</h3>
        <button
          onClick={() => fetchLogs()}
          className="text-xs text-[#A88A3A] hover:text-[#C9A84C] transition-colors"
        >
          Actualizar
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-10 h-10 mx-auto text-[#D4D4D9] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <p className="text-sm text-[#9CA3AF]">No hay ejecuciones registradas todavía.</p>
          <p className="text-xs text-[#B0B0B8] mt-1">Las reglas se ejecutan cuando se emiten webhooks.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-xl border text-sm ${
                log.success
                  ? 'bg-[#FAFAFC] border-[#ECECF1]'
                  : 'bg-[#FEF3F3] border-[#F6D6D6]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    log.conditions_met
                      ? log.success ? 'bg-[#16A34A]' : 'bg-[#DC2626]'
                      : 'bg-[#D4D4D9]'
                  }`} />
                  <span className="text-xs font-medium text-[#1A1A1A] truncate">{log.rule_name}</span>
                  <span className="text-[10px] font-mono bg-[#FBF6E9] text-[#A88A3A] px-1.5 py-0.5 rounded">
                    {log.topic}
                  </span>
                </div>
                <span className="text-[11px] text-[#9CA3AF] whitespace-nowrap ml-2">
                  {new Date(log.created_at).toLocaleString('es-ES')}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#6B7280]">
                <span>Condiciones: {log.conditions_met ? 'Cumplidas' : 'No cumplidas'}</span>
                <span>{log.execution_ms}ms</span>
              </div>
              {log.error_message && (
                <p className="text-xs text-[#DC2626] mt-1">{log.error_message}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setView('list')}
        className="text-xs text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
      >
        ← Volver a reglas
      </button>
    </div>
  );

  // ============================================================
  // Render: Rule List
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (view === 'create' || view === 'edit') return ruleForm();
  if (view === 'logs') return logsView();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#6B7280]">
            {rules.length} regla{rules.length !== 1 ? 's' : ''} configurada{rules.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('logs')}
            className="flex items-center gap-1.5 text-xs text-[#6B7280] bg-white border border-[#ECECF1] px-3 py-2 rounded-lg hover:bg-[#F5F5F8] transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Historial
          </button>
          <button
            onClick={() => startEdit()}
            className="flex items-center gap-1.5 text-xs text-white px-3 py-2 rounded-lg font-medium shadow-sm hover:shadow transition-all"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva regla
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm rounded-xl px-4 py-3 border bg-[#FEF3F3] border-[#F6D6D6] text-[#DC2626]">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-xs underline">Cerrar</button>
        </div>
      )}

      {/* Rules */}
      {rules.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 mx-auto text-[#D4D4D9] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <p className="text-sm text-[#6B7280]">No hay reglas de automatización</p>
          <p className="text-xs text-[#9CA3AF] mt-1">Crea reglas para automatizar acciones cuando ocurran eventos.</p>
          <button
            onClick={() => startEdit()}
            className="mt-4 flex items-center gap-1.5 text-sm text-white px-4 py-2.5 rounded-xl font-medium shadow-sm hover:shadow transition-all mx-auto"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Crear primera regla
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {rules.map(ruleCard)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
