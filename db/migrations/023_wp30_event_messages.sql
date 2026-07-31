-- ============================================================
-- Migración 023 — WP-30: Portal Mensajería Integrada en CRM
-- ============================================================
-- Crea la tabla event_messages para el hilo cliente↔equipo.
-- Cada mensaje del cliente crea automáticamente una interacción CRM.
-- ============================================================

-- 1. Tabla event_messages: hilo de mensajes por evento
CREATE TABLE IF NOT EXISTS event_messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sender      TEXT NOT NULL CHECK (sender IN ('cliente', 'equipo')),
    sender_name TEXT,                          -- nombre del remitente (cliente o miembro del equipo)
    body        TEXT NOT NULL,
    read_at     TIMESTAMPTZ,                   -- NULL = no leído
    created_by  UUID REFERENCES admins(id) ON DELETE SET NULL,  -- solo para mensajes del equipo
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_event_messages_event ON event_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_unread ON event_messages(event_id, sender) 
    WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_messages_created ON event_messages(event_id, created_at DESC);

ALTER TABLE event_messages DISABLE ROW LEVEL SECURITY;

-- 2. Función para contar mensajes no leídos por evento y origen
CREATE OR REPLACE FUNCTION count_unread_messages(p_event_id UUID, p_sender TEXT)
RETURNS INT AS $$
    SELECT COUNT(*)::INT 
    FROM event_messages 
    WHERE event_id = p_event_id 
      AND sender = p_sender 
      AND read_at IS NULL;
$$ LANGUAGE sql STABLE;

-- 3. Vista para obtener resumen de mensajes por evento (para dashboard)
CREATE OR REPLACE VIEW v_event_messages_summary AS
SELECT 
    event_id,
    COUNT(*) FILTER (WHERE sender = 'cliente' AND read_at IS NULL) AS unread_from_cliente,
    COUNT(*) FILTER (WHERE sender = 'equipo' AND read_at IS NULL) AS unread_from_equipo,
    COUNT(*) FILTER (WHERE sender = 'cliente') AS total_from_cliente,
    COUNT(*) FILTER (WHERE sender = 'equipo') AS total_from_equipo,
    MAX(created_at) AS last_message_at
FROM event_messages
GROUP BY event_id;

-- ============================================================
-- Verificación
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_messages') THEN
        RAISE NOTICE 'WP-30 OK: event_messages creada';
    ELSE
        RAISE EXCEPTION 'WP-30 FALLO: tabla event_messages no creada';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_event_messages_summary') THEN
        RAISE NOTICE 'WP-30 OK: v_event_messages_summary creada';
    ELSE
        RAISE EXCEPTION 'WP-30 FALLO: vista v_event_messages_summary no creada';
    END IF;
END $$;