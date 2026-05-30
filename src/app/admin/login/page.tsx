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
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F8] px-6">
      <div className="w-full max-w-[400px]">
        <div className="bg-white rounded-3xl border border-[#ECECF1] shadow-[0_12px_40px_rgba(16,24,40,0.08)] overflow-hidden">
          {/* Brand banner */}
          <div className="relative h-28 flex items-center justify-center"
            style={{ background: '#1A1208 url(/images/hero-poster.svg) center/cover' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,8,6,0.45), rgba(10,8,6,0.75))' }} />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              <span className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>JB</span>
            </div>
          </div>

          <div className="p-8">
            <div className="text-center mb-7">
              <h1 className="text-[#1A1A1A] text-2xl font-serif mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                J. Benitez
              </h1>
              <p className="text-[#9CA3AF] text-sm">Panel de gestión</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-[#FEF3F3] border border-[#F6D6D6] rounded-xl p-3 text-sm text-[#DC2626] text-center">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1.5 ml-1">Usuario</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-4 py-3 rounded-xl bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] placeholder-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all text-base"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1.5 ml-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] placeholder-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all text-base"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-3.5 rounded-xl font-semibold text-base text-white transition-all duration-200 mt-2 shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
              >
                {loading ? 'Entrando...' : 'Entrar al panel'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-[#A8A8B0]">
          EventFlow v1.0 &mdash; J. Benitez
        </p>
      </div>
    </div>
  );
}