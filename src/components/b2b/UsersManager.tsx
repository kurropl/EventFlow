'use client';
/**
 * EventFlow — Gestión de usuarios y perfiles (RBAC · FR-R04)
 *
 * Solo accesible por Administración (el API /api/admin/users lo aplica en servidor).
 * Permite crear usuarios, asignarles un perfil y activarlos/desactivarlos.
 */
import { useState, useEffect, useCallback } from 'react';
import Icon from '../shared/Icon';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/rbac';
import { formatDate } from '@/lib/format';

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  last_login: string | null;
}

const empty = { email: '', name: '', password: '', role: 'cocina' as Role };

export default function UsersManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/users');
      if (r.status === 403) { setDenied(true); return; }
      const j = await r.json();
      if (j.success) setUsers(j.data || []);
    } catch { /* noop */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500); };

  const create = async () => {
    if (!form.email || !form.name || !form.password) { flash('Completa email, nombre y contraseña'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const j = await r.json();
      if (j.success) { setForm(empty); flash('Usuario creado'); load(); }
      else flash(j.error || 'No se pudo crear');
    } catch { flash('Error de red'); } finally { setBusy(false); }
  };

  const update = async (id: string, patch: Partial<User>) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    load();
  };

  if (denied) return null; // no es admin → no se muestra la sección

  return (
    <div className="rounded-2xl border border-[#ECECF1] bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="users" className="w-5 h-5 text-[#C9A84C]" />
        <h2 className="text-lg font-semibold text-[#1A1A1A]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Usuarios y perfiles
        </h2>
      </div>
      <p className="text-xs text-[#8A8A92] mb-4">
        Cada perfil ve y usa solo sus módulos. La autorización se aplica también en el servidor.
      </p>

      {msg && <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-[#F8F3E6] text-[#7A5C00] border border-[#E8D9A8]">{msg}</div>}

      {/* Alta de usuario */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-5">
        <input className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2" placeholder="Email"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <input className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2" placeholder="Nombre"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2" placeholder="Contraseña" type="password"
          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        <select className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2"
          value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <button onClick={create} disabled={busy}
          className="text-sm font-medium text-white rounded-lg px-3 py-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
          <Icon name="plus" className="w-4 h-4 inline mr-1" /> Crear
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-[#8A8A92]">Cargando…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-[#8A8A92]">No hay usuarios.</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[#F0F0F4]">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1A1A1A] truncate">{u.name} <span className="text-[#B0B0B8] font-normal">· {u.email}</span></p>
                <p className="text-[11px] text-[#8A8A92]">{u.last_login ? `Último acceso: ${formatDate(u.last_login)}` : 'Sin accesos'}</p>
              </div>
              <select className="text-xs border border-[#E5E7EB] rounded-lg px-2 py-1.5"
                value={u.role} onChange={e => update(u.id, { role: e.target.value as Role })}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button onClick={() => update(u.id, { active: !u.active })}
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border ${u.active ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-[#E5E7EB] text-[#8A8A92] bg-[#F8F8FA]'}`}>
                {u.active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
