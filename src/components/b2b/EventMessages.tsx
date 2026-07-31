'use client';

/**
 * EventFlow — Event Messages Component (WP-30)
 * Hilo de mensajes cliente↔equipo dentro de la ficha del evento.
 * Permite enviar mensajes del equipo y ver mensajes del cliente.
 */

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Check, CheckCheck, User, Users } from 'lucide-react';
import { sanitizeText } from '@/lib/security';

/* ── Types ──────────────────────────────────────────────────────── */
interface Message {
  id: string;
  event_id: string;
  sender: 'cliente' | 'equipo';
  sender_name: string | null;
  body: string;
  read_at: string | null;
  created_by: string | null;
  created_at: string;
  admin_name?: string;
}

interface UnreadCounts {
  from_cliente: number;
  from_equipo: number;
}

interface MessagesData {
  messages: Message[];
  unread: UnreadCounts;
}

/* ── Helpers ────────────────────────────────────────────────────── */
const fmtTime = (d: string) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

const fmtDate = (d: string) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

/* ── Message Bubble ─────────────────────────────────────────────── */
function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2 ${
          isOwn
            ? 'bg-gold text-cream-dark rounded-br-sm'
            : 'bg-cream-dark text-ink border border-gold/10 rounded-bl-sm'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          {isOwn ? (
            <Users className="w-3 h-3 opacity-70" />
          ) : (
            <User className="w-3 h-3 opacity-70" />
          )}
          <span className={`text-[10px] font-medium ${isOwn ? 'opacity-70' : 'text-ink-soft-60'}`}>
            {message.sender_name || (isOwn ? 'Equipo' : 'Cliente')}
          </span>
          <span className={`text-[10px] ${isOwn ? 'opacity-50' : 'text-ink-soft-60'}`}>
            {fmtTime(message.created_at)}
          </span>
          {isOwn && message.read_at && (
            <CheckCheck className="w-3 h-3 opacity-50" />
          )}
          {isOwn && !message.read_at && (
            <Check className="w-3 h-3 opacity-50" />
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────── */
interface EventMessagesProps {
  eventId: string;
}

export default function EventMessages({ eventId }: EventMessagesProps) {
  const [data, setData] = useState<MessagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Fetch messages ──────────────────────────────────────────── */
  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/messages`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Error al cargar mensajes');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  /* ── Mark messages as read ───────────────────────────────────── */
  const markAsRead = async () => {
    try {
      await fetch(`/api/events/${eventId}/messages/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: 'cliente' }),
      });
      // Actualizar estado local
      if (data) {
        setData({
          ...data,
          unread: { ...data.unread, from_cliente: 0 },
          messages: data.messages.map((m) =>
            m.sender === 'cliente' && !m.read_at
              ? { ...m, read_at: new Date().toISOString() }
              : m
          ),
        });
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  /* ── Send message ────────────────────────────────────────────── */
  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });

      const json = await res.json();
      if (json.success) {
        setNewMessage('');
        await fetchMessages();
        // Scroll al final
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        setError(json.error || 'Error al enviar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setSending(false);
    }
  };

  /* ── Keyboard shortcut ───────────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Effects ─────────────────────────────────────────────────── */
  useEffect(() => {
    fetchMessages();
  }, [eventId]);

  // Marcar como leídos cuando se abre la pestaña
  useEffect(() => {
    if (data && data.unread.from_cliente > 0) {
      markAsRead();
    }
  }, [data?.unread.from_cliente]);

  // Auto-scroll al cargar
  useEffect(() => {
    if (!loading && data?.messages.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading]);

  /* ── Render ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gold/15 rounded animate-pulse" />
        <div className="h-64 bg-gold/10 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 text-sm">{error}</p>
        <button
          onClick={() => { setError(null); fetchMessages(); }}
          className="mt-2 text-gold text-sm hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const messages = data?.messages || [];
  const unread = data?.unread || { from_cliente: 0, from_equipo: 0 };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gold/20">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-gold" />
          <h3 className="font-heading font-semibold text-gold">Mensajes</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {unread.from_cliente > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white rounded-full font-medium">
              {unread.from_cliente} nuevos del cliente
            </span>
          )}
          <span className="text-ink-soft-60">
            {messages.length} mensaje{messages.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gold/30 mx-auto mb-3" />
            <p className="text-ink-soft-60 text-sm">
              No hay mensajes aún. El cliente puede enviar mensajes desde su portal.
            </p>
          </div>
        ) : (
          [...messages].reverse().map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender === 'equipo'}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-gold/20">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje al cliente..."
            className="flex-1 resize-none rounded-lg border border-gold/30 bg-cream-dark px-3 py-2 text-sm text-ink placeholder:text-ink-soft-60 focus:outline-none focus:ring-2 focus:ring-gold/50"
            rows={2}
            maxLength={2000}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="self-end px-4 py-2 bg-gold text-cream-dark rounded-lg hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-ink-soft-60 mt-1">
          Enter para enviar · Shift+Enter para nueva línea · Máx. 2000 caracteres
        </p>
      </div>
    </div>
  );
}
