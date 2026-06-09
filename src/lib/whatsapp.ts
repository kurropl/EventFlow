/**
 * EventFlow — WhatsApp Client Abstraction
 * 
 * Provides a unified interface for sending WhatsApp messages.
 * Default implementation uses WhatsApp Cloud API (Meta).
 * Credentials are read from environment variables — never hardcoded.
 */

// ============================================================
// Types
// ============================================================

export interface WhatsAppClient {
  sendMessage(phone: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  text: { body: string };
}

// ============================================================
// WhatsApp Cloud API Implementation
// ============================================================

class WhatsAppCloudClient implements WhatsAppClient {
  private apiUrl: string;
  private token: string;
  private phoneNumberId: string;

  constructor() {
    this.token = process.env.WHATSAPP_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.apiUrl = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
  }

  async sendMessage(phone: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.token || !this.phoneNumberId) {
      console.warn('[whatsapp] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured');
      return { success: false, error: 'WhatsApp not configured' };
    }

    // Normalize phone: remove + prefix, ensure country code
    const normalizedPhone = phone.replace(/^\+/, '').replace(/\s/g, '');

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'text',
          text: { body },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[whatsapp] Send failed:', data.error?.message || data);
        return { success: false, error: data.error?.message || 'Send failed' };
      }

      const messageId = data.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (error) {
      console.error('[whatsapp] Network error:', error);
      return { success: false, error: String(error) };
    }
  }
}

// ============================================================
// Mock Client (for development/testing)
// ============================================================

class MockWhatsAppClient implements WhatsAppClient {
  private sent: Array<{ phone: string; body: string; timestamp: Date }> = [];

  async sendMessage(phone: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.sent.push({ phone, body, timestamp: new Date() });
    console.log(`[whatsapp:mock] → ${phone}\n${body}\n`);
    return { success: true, messageId };
  }

  getSent() { return [...this.sent]; }
  clearSent() { this.sent = []; }
}

// ============================================================
// Factory
// ============================================================

let clientInstance: WhatsAppClient | null = null;

export function getWhatsAppClient(): WhatsAppClient {
  if (!clientInstance) {
    const mode = process.env.WHATSAPP_MODE || 'mock';
    if (mode === 'cloud') {
      clientInstance = new WhatsAppCloudClient();
    } else {
      clientInstance = new MockWhatsAppClient();
    }
  }
  return clientInstance;
}

// ============================================================
// Message Templates
// ============================================================

export function buildStaffingOfferMessage(params: {
  workerName: string;
  roleName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  uniform: string;
}): string {
  return `🔔 *Nueva oferta de trabajo*

Hola ${params.workerName}, tienes una nueva oferta:

📅 *Fecha:* ${params.eventDate}
⏰ *Horario:* ${params.startTime} — ${params.endTime}
📍 *Lugar:* ${params.location}
👔 *Vestimenta:* ${params.uniform}
🎭 *Rol:* ${params.roleName}

¿Aceptas? Responde:
✅ *ACEPTAR*
❌ *RECHAZAR*

EventFlow · J.Benitez`;
}

export function buildStaffingConfirmationMessage(params: {
  workerName: string;
  roleName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  uniform: string;
  position: number;
}): string {
  return `✅ *¡Plaza confirmada!*

${params.workerName}, tu plaza ha sido confirmada:

🎭 *Rol:* ${params.roleName}
📅 *Fecha:* ${params.eventDate}
⏰ *Horario:* ${params.startTime} — ${params.endTime}
📍 *Lugar:* ${params.location}
👔 *Vestimenta:* ${params.uniform}
🔢 *Position:* #${params.position}

¡Nos vemos en el evento! 🎉

EventFlow · J.Benitez`;
}

export function buildStaffingFullMessage(params: {
  workerName: string;
  roleName: string;
  eventDate: string;
}): string {
  return `❌ *Plaza cubierta*

${params.workerName}, la plaza de ${params.roleName} para el ${params.eventDate} ya ha sido cubierta por otro trabajador.

Gracias por tu interés. ¡La próxima vez será!

EventFlow · J.Benitez`;
}
