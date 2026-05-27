'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push('/admin/kanban');
      } else {
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0d0a06 0%, #1a1208 100%)' }}>
      <div className="w-full max-w-md px-6">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full border-2 border-[#d4a548] flex items-center justify-center mx-auto mb-4"
            style={{ fontFamily: "'Playfair Display', serif", color: '#d4a548', fontStyle: 'italic', fontWeight: 700, fontSize: '1.8rem' }}>
            J.B
          </div>
          <h1 className="text-[#d4a548] text-2xl font-serif mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
            J. Benitez
          </h1>
          <p className="text-stone-500 text-sm">Panel de Administración</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-3 text-sm text-red-400 text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1.5 ml-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-4 py-3.5 rounded-xl bg-stone-900/80 border border-stone-700/60 text-stone-200 placeholder-stone-500 focus:border-[#d4a548] focus:outline-none transition-colors text-base"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1.5 ml-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full px-4 py-3.5 rounded-xl bg-stone-900/80 border border-stone-700/60 text-stone-200 placeholder-stone-500 focus:border-[#d4a548] focus:outline-none transition-colors text-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-200 mt-2"
            style={{
              background: loading ? '#6b2737' : '#d4a548',
              color: '#fff',
              opacity: loading || !username || !password ? 0.6 : 1,
              cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar al Panel'}
          </button>
        </form>

        <p className="text-center mt-8 text-xs text-stone-600">
          EventFlow v1.0 &mdash; J. Benitez
        </p>
      </div>
    </div>
  );
}