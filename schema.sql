-- ============================================================
-- EventFlow — SQL Schema + Seed Data (Alboroto Eventos 2025)
-- Supabase / PostgreSQL 15+
-- Fuente: https://byalboroto.duckdns.org/
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. CATALOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS catalog_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    category    TEXT NOT NULL CHECK (category IN (
        'aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa',
        'carne', 'pescado', 'arroz', 'sorbete', 'postre', 'bebida',
        'complemento'
    )),
    subcategory TEXT,
    pvp         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (pvp >= 0),
    cost        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_url   TEXT,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_active ON catalog_items(category, active);

-- ============================================================
-- 2. PROPOSED MENUS (menús predefinidos del PDF)
-- ============================================================
CREATE TABLE IF NOT EXISTS proposed_menus (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    tag             TEXT NOT NULL,
    suggested_price NUMERIC(10,2) NOT NULL,
    is_kid          BOOLEAN NOT NULL DEFAULT false,
    sections        JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. EVENTS (budgets)
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id         TEXT, -- menu1, menu2, etc. or UUID
    quote_id        UUID,  -- FK a quotes(id) añadida tras crear quotes (ref. circular); ver final del fichero
    client_name     TEXT NOT NULL,
    client_email    TEXT NOT NULL,
    client_phone    TEXT,
    event_type      TEXT NOT NULL CHECK (event_type IN ('boda','cumpleaños','corporativo','bautizo','comunión','otro')),
    guest_count     INT NOT NULL CHECK (guest_count > 0),
    kids_count      INT NOT NULL DEFAULT 0,
    event_date      DATE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('nuevo','propuesta_enviada','confirmado','cancelado','en_curso','completado')),
    service_type    TEXT NOT NULL DEFAULT 'menu' CHECK (service_type IN ('coctel','menu')),
    selected_items  JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_pvp       NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
    bar_hours       INT NOT NULL DEFAULT 0 CHECK (bar_hours >= 0 AND bar_hours <= 3),
    bar_price       NUMERIC(10,2) NOT NULL DEFAULT 0,
    iva_pct         NUMERIC(5,2) NOT NULL DEFAULT 10,
    notes           TEXT,
    linen_type      TEXT DEFAULT 'blanco',
    centerpiece     TEXT DEFAULT 'floral',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_quote ON events(quote_id);

-- ============================================================
-- 4. COST BREAKDOWN
-- ============================================================
CREATE TABLE IF NOT EXISTS cost_desglose (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    line_type   TEXT NOT NULL CHECK (line_type IN ('plato','servicio','personal','montaje','extras','margen')),
    description TEXT NOT NULL,
    quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
    total       NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. WEBHOOK LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID REFERENCES events(id),
    topic       TEXT NOT NULL,
    payload     JSONB NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    response    TEXT,
    retries     INT NOT NULL DEFAULT 0,
    sent_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. BAR CONFIG (precios barra libre por horas)
-- ============================================================
CREATE TABLE IF NOT EXISTS bar_config (
    hours     INT PRIMARY KEY CHECK (hours BETWEEN 0 AND 3),
    price     NUMERIC(10,2) NOT NULL,
    label     TEXT NOT NULL DEFAULT ''
);

INSERT INTO bar_config (hours, price, label) VALUES
    (0, 0,    'Sin barra libre'),
    (1, 10.00, '1 hora'),
    (2, 16.00, '2 horas'),
    (3, 18.00, '3 horas');

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================
-- NOTE: This is a self-hosted deployment. The app connects to Postgres with a
-- single role via `pg` (src/lib/db.ts) and enforces authentication/authorization
-- at the API + middleware layer (src/middleware.ts, src/lib/auth.ts).
--
-- The original Supabase-style policies below relied on `auth.jwt()`, a function
-- that only exists inside Supabase. On plain Postgres that function is missing,
-- so once RLS is enforced for a non-superuser role EVERY insert/select on these
-- tables fails with "Database query failed" — which is exactly what broke the
-- configurador when submitting a budget. We therefore leave RLS DISABLED here;
-- access control lives in the application layer instead.
--
-- (Kept disabled intentionally — do not re-enable without providing an
-- auth.jwt() equivalent.)
ALTER TABLE catalog_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_menus DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE cost_desglose DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE bar_config DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_catalog_updated BEFORE UPDATE ON catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. SEED DATA — CATÁLOGO ALBOROTO EVENTOS (118 items)
-- ============================================================

-- APERITIVOS FRÍOS (26 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Ensaladilla cremosa, huevo frito y gamba cristal', 'aperitivo-frio', 0, 0, '[{"name":"ensaladilla","grams":60},{"name":"huevo frito","count":1},{"name":"gamba cristal","count":2}]'),
('Papas aliñás de Sanlúcar', 'aperitivo-frio', 0, 0, '[{"name":"patata","grams":100},{"name":"atún","grams":20},{"name":"cebolla","grams":30}]'),
('Anchoa 00 y mantequilla trufada', 'aperitivo-frio', 0, 0, '[{"name":"anchoa 00","count":2},{"name":"mantequilla trufada","grams":10}]'),
('Chacinas y quesos', 'aperitivo-frio', 0, 0, '[{"name":"jamón serrano","grams":30},{"name":"queso curado","grams":30},{"name":"lomito","grams":20}]'),
('Gazpacho de remolacha y queso feta', 'aperitivo-frio', 0, 0, '[{"name":"tomate","grams":150},{"name":"remolacha","grams":50},{"name":"queso feta","grams":30}]'),
('Tosta de queso payoyo, tomate seco y chicharrones', 'aperitivo-frio', 0, 0, '[{"name":"pan tostada","count":1},{"name":"queso payoyo","grams":30},{"name":"tomate seco","grams":15}]'),
('Brioche de steak tartar de salchichón', 'aperitivo-frio', 0, 0, '[{"name":"brioche","count":1},{"name":"salchichón","grams":25}]'),
('Brioche de tomate, ventresca de atún y eneldo', 'aperitivo-frio', 0, 0, '[{"name":"brioche","count":1},{"name":"ventresca","grams":25},{"name":"tomate","grams":20}]'),
('Steak tartar sobre croissant crujiente', 'aperitivo-frio', 0, 0, '[{"name":"croissant","count":1},{"name":"steak tartar","grams":30}]'),
('Carpaccio de vaca vieja madurada, tomate y trufa', 'aperitivo-frio', 0, 0, '[{"name":"vaca vieja","grams":35},{"name":"tomate","grams":15},{"name":"trufa","grams":2}]'),
('Tartaleta de manzana ácida y erizo', 'aperitivo-frio', 0, 0, '[{"name":"masa tartaleta","count":1},{"name":"manzana","grams":40},{"name":"erizo","grams":10}]'),
('Tartar de calamar, carbonara de coliflor y caviar ahumado', 'aperitivo-frio', 0, 0, '[{"name":"calamar","grams":40},{"name":"coliflor","grams":20},{"name":"caviar ahumado","grams":5}]'),
('Crujiente de salmón y aguacate', 'aperitivo-frio', 0, 0, '[{"name":"salmón","grams":30},{"name":"aguacate","grams":20}]'),
('Tartar de atún rojo picante y huevo frito', 'aperitivo-frio', 0, 0, '[{"name":"atún rojo","grams":40},{"name":"huevo frito","count":1}]'),
('Conito de atún rojo, soja blanca y guacamole', 'aperitivo-frio', 0, 0, '[{"name":"atún rojo","grams":35},{"name":"soja blanca","grams":10},{"name":"aguacate","grams":15}]'),
('Cereza de foie', 'aperitivo-frio', 0, 0, '[{"name":"foie gras","grams":40}]'),
('Foie, maíz y trufa', 'aperitivo-frio', 0, 0, '[{"name":"foie gras","grams":35},{"name":"maíz tierno","grams":20},{"name":"trufa","grams":2}]'),
('Milhojas de anguila ahumada', 'aperitivo-frio', 0, 0, '[{"name":"anguila ahumada","grams":30}]'),
('Mini ensalada César', 'aperitivo-frio', 0, 0, '[{"name":"lechuga romana","grams":40},{"name":"pollo","grams":20},{"name":"parmesano","grams":5}]'),
('Mini ensalada de gambones en tempura y salsa yogurt', 'aperitivo-frio', 0, 0, '[{"name":"gambones","count":2},{"name":"tempura","grams":10}]'),
('Mini ensalada caprese', 'aperitivo-frio', 0, 0, '[{"name":"tomate","grams":40},{"name":"mozzarella","grams":40},{"name":"albahaca","grams":3}]'),
('Salpicón de vieira y ají amarillo', 'aperitivo-frio', 0, 0, '[{"name":"vieira","count":2},{"name":"ají amarillo","grams":5}]'),
('Navaja de buzo, emulsión de hierbas y lima', 'aperitivo-frio', 0, 0, '[{"name":"navaja","count":2}]'),
('Gilda de atún rojo y encurtidos', 'aperitivo-frio', 0, 0, '[{"name":"atún rojo","grams":15},{"name":"aceituna","count":1},{"name":"picadillo","grams":5}]'),
('Gilda de salmón ahumado y encurtidos', 'aperitivo-frio', 0, 0, '[{"name":"salmón ahumado","grams":15},{"name":"aceituna","count":1}]'),
('Ostras al natural / toppings', 'aperitivo-frio', 0, 0, '[{"name":"ostra","count":1},{"name":"limón","count":1}]');

-- APERITIVOS CALIENTES (21 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Gyozas de pringá, crema de remolacha y hierbabuena', 'aperitivo-caliente', 0, 0, '[{"name":"masa gyozas","count":3},{"name":"pringá","grams":40}]'),
('Empanadillas de boletus, carrillera y trufa', 'aperitivo-caliente', 0, 0, '[{"name":"masa empanada","count":2},{"name":"boletus","grams":25},{"name":"carrillera","grams":20}]'),
('Empanadillas de ventresca de atún con tomate', 'aperitivo-caliente', 0, 0, '[{"name":"masa empanada","count":2},{"name":"ventresca","grams":25}]'),
('Croquetas de jamón ibérico', 'aperitivo-caliente', 0, 0, '[{"name":"jamón ibérico","grams":30},{"name":"bechamel","grams":80}]'),
('Croquetas de queso de cabra, trufa y presa', 'aperitivo-caliente', 0, 0, '[{"name":"queso cabra","grams":25},{"name":"presa","grams":20}]'),
('Mini hot dog de chistorra criolla y mayo-japo', 'aperitivo-caliente', 0, 0, '[{"name":"pan hot dog","count":1},{"name":"chistorra","grams":30}]'),
('Mini pita de pringá y ali oli de hierbabuena', 'aperitivo-caliente', 0, 0, '[{"name":"pan pita","count":1},{"name":"pringá","grams":40}]'),
('Bocadillo de cola de toro, yema de huevo y queso comté', 'aperitivo-caliente', 0, 0, '[{"name":"pan baguette","count":1},{"name":"cola de toro","grams":50}]'),
('Bao bun de costilla con salsa BBQ-miso', 'aperitivo-caliente', 0, 0, '[{"name":"pan bao","count":1},{"name":"costilla","grams":50}]'),
('Bao bun de langostino en tempura y kimchi', 'aperitivo-caliente', 0, 0, '[{"name":"pan bao","count":1},{"name":"langostino","count":2}]'),
('Alita de pollo deshuesada y teriyaki de ajos', 'aperitivo-caliente', 0, 0, '[{"name":"alita pollo","count":2}]'),
('Atún encebollado a nuestra manera', 'aperitivo-caliente', 0, 0, '[{"name":"atún","grams":40},{"name":"cebolla","grams":30}]'),
('Mini vieira rellena de mariscos y salsa coreana', 'aperitivo-caliente', 0, 0, '[{"name":"vieira","count":2}]'),
('Lubina / gallineta, frita entera en adobo', 'aperitivo-caliente', 0, 0, '[{"name":"lubina","grams":50}]'),
('Choco frito de nuestras costas', 'aperitivo-caliente', 0, 0, '[{"name":"choco","grams":60}]'),
('Alcachofas fritas, queso trufado y jamón ibérico', 'aperitivo-caliente', 0, 0, '[{"name":"alcachofa","count":2},{"name":"jamón ibérico","grams":10}]'),
('Alcachofas y gambas al ajillo', 'aperitivo-caliente', 0, 0, '[{"name":"alcachofa","count":2},{"name":"gambas","count":3}]'),
('Calamares a la riojana, hechos en casa', 'aperitivo-caliente', 0, 0, '[{"name":"calamar","grams":60}]'),
('Marmitaco de cangrejo azul y rape', 'aperitivo-caliente', 0, 0, '[{"name":"cangrejo","grams":40},{"name":"rape","grams":40}]'),
('Brocheta de langostino y mango', 'aperitivo-caliente', 0, 0, '[{"name":"langostino","count":2},{"name":"mango","grams":30}]'),
('Brocheta de solomillo y anticucho', 'aperitivo-caliente', 0, 0, '[{"name":"solomillo","grams":50}]');

-- A COMPARTIR EN MESA (12 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Canelón de carabinero relleno de marisco, mango y aguacate', 'compartir-mesa', 0, 0, '[{"name":"carabinero","grams":40}]'),
('Lingote de foie, queso de cabra y compota de pera asada', 'compartir-mesa', 0, 0, '[{"name":"foie gras","grams":50}]'),
('Carpaccio de vaca vieja madurada con trufa y colmenillas', 'compartir-mesa', 0, 0, '[{"name":"vaca vieja","grams":40}]'),
('Tartar de tomate y quisquilla, gazpacho de tomates amarillos', 'compartir-mesa', 0, 0, '[{"name":"tomate","grams":100},{"name":"quisquilla","count":4}]'),
('Canelón de calabacín y aguacate relleno de cangrejo al kimchi', 'compartir-mesa', 0, 0, '[{"name":"calabacín","count":1},{"name":"cangrejo","grams":30}]'),
('Chacina variada (jamón, queso y lomito de presa)', 'compartir-mesa', 0, 0, '[{"name":"jamón","grams":40},{"name":"queso","grams":40},{"name":"lomito","grams":30}]'),
('Mariscada (langostinos, gambas, cigala)', 'compartir-mesa', 0, 0, '[{"name":"langostinos","count":4},{"name":"gambas","count":4},{"name":"cigala","count":2}]'),
('Berenjena a la brasa, glaseada con teriyaki y celery', 'compartir-mesa', 0, 0, '[{"name":"berenjena","count":1}]'),
('Espárrago blanco 00 relleno de langostinos al ajillo', 'compartir-mesa', 0, 0, '[{"name":"espárrago blanco","count":3},{"name":"langostino","count":2}]'),
('Canelón de boletus con cola de toro y salsa de foie al PX', 'compartir-mesa', 0, 0, '[{"name":"boletus","grams":40},{"name":"cola de toro","grams":30}]'),
('Huevos rotos estilo Alboroto (papada ibérica y gambones)', 'compartir-mesa', 0, 0, '[{"name":"huevos","count":2},{"name":"papada ibérica","grams":30}]'),
('Pulpo a la brasa, parmentier de patata y mojo picón', 'compartir-mesa', 0, 0, '[{"name":"pulpo","grams":80}]');

-- CARNES (7 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Carrillera a baja temperatura con puré de patatas trufado', 'carne', 0, 0, '[{"name":"carrillera","grams":150},{"name":"patata","grams":100}]'),
('Cordero a baja temperatura, patatas fritas al ajillo y su jugo', 'carne', 0, 0, '[{"name":"cordero","grams":180}]'),
('Lasaña de carrillera gratinada con queso pecorino', 'carne', 0, 0, '[{"name":"carrillera","grams":120},{"name":"pasta lasaña","count":3}]'),
('Presa a la brasa, salsa al whisky, patatas fritas, padrón y piquillos', 'carne', 0, 0, '[{"name":"presa ibérica","grams":160}]'),
('Confit de pato, risotto de calabaza y salsa Pekín', 'carne', 0, 0, '[{"name":"muslo pato","grams":180}]'),
('Solomillo de vaca vieja, cremoso de patata y salsa a la pimienta negra', 'carne', 0, 0, '[{"name":"solomillo","grams":180}]'),
('Ciervo a baja temperatura, cremoso de boniato y su salsa reducida', 'carne', 0, 0, '[{"name":"ciervo","grams":160}]');

-- PESCADOS (6 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Lubina, cremoso de coliflor y jugo del cocido', 'pescado', 0, 0, '[{"name":"lubina","grams":200}]'),
('Rodaballo y verduritas de temporada a la bilbaína', 'pescado', 0, 0, '[{"name":"rodaballo","grams":220}]'),
('Ventresca de atún rojo al horno con fritada de tomates', 'pescado', 0, 0, '[{"name":"ventresca atún","grams":180}]'),
('Lomo de bacalao confitado, espinacas ahumadas a la crema', 'pescado', 0, 0, '[{"name":"bacalao","grams":180}]'),
('Merluza gratinada con crema de ajo asado y salsa roteña', 'pescado', 0, 0, '[{"name":"merluza","grams":200}]'),
('Merluza rellena de mariscos y almejas a la marinera', 'pescado', 0, 0, '[{"name":"merluza","grams":200}]');

-- ARROCES (2 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Arroz meloso de mariscos y pescados de roca', 'arroz', 0, 0, '[{"name":"arroz bomba","grams":150}]'),
('Arroz meloso de carrillera, setas y foie', 'arroz', 0, 0, '[{"name":"arroz bomba","grams":150}]');

-- SORBETES (5 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Sorbete de limón', 'sorbete', 0, 0, '[{"name":"limón","grams":100}]'),
('Sorbete de mandarina', 'sorbete', 0, 0, '[{"name":"mandarina","grams":100}]'),
('Sorbete de piña asada, helado de coco y gelatina de ron', 'sorbete', 0, 0, '[{"name":"piña","grams":100}]'),
('Sorbete de lima, helado de menta y hierbabuena escarchada', 'sorbete', 0, 0, '[{"name":"lima","grams":100}]'),
('Sorbete de frutos rojos, helado de queso y coulis de fresa', 'sorbete', 0, 0, '[{"name":"frutos rojos","grams":100}]');

-- POSTRES (8 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Tarta de celebración', 'postre', 0, 0, '[{"name":"bizcocho","count":1}]'),
('Lemon pie', 'postre', 0, 0, '[{"name":"base galleta","count":1},{"name":"limón","grams":80}]'),
('Torrija, helado de vainilla y toffee de coco', 'postre', 0, 0, '[{"name":"pan torrija","count":1}]'),
('Mucho chocolate', 'postre', 0, 0, '[{"name":"chocolate","grams":80}]'),
('Tarta de queso', 'postre', 0, 0, '[{"name":"queso crema","grams":200}]'),
('Pantera rosa', 'postre', 0, 0, '[{"name":"merengue","count":1}]'),
('Helado de yogurt con tocino y nueces caramelizadas', 'postre', 0, 0, '[{"name":"yogurt","grams":100}]'),
('Surtido de minipasteles', 'postre', 0, 0, '[{"name":"minipasteles","count":3}]');

-- BEBIDAS (8 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Cerveza con y sin', 'bebida', 0, 0, '[{"name":"cerveza","ml":330}]'),
('Vino tinto Lomas del Marquez', 'bebida', 0, 0, '[{"name":"rioja","ml":125}]'),
('Vino blanco Verdejo', 'bebida', 0, 0, '[{"name":"verdejo","ml":125}]'),
('Frizzante', 'bebida', 0, 0, '[{"name":"frizzante","ml":125}]'),
('Manzanilla', 'bebida', 0, 0, '[{"name":"manzanilla","ml":100}]'),
('Refrescos', 'bebida', 0, 0, '[{"name":"refresco","ml":330}]'),
('Agua', 'bebida', 0, 0, '[{"name":"agua","ml":500}]'),
('Cava brindis', 'bebida', 0, 0, '[{"name":"cava","ml":100}]');

-- COMPLEMENTOS / ESTACIONES (23 items)
INSERT INTO catalog_items (name, category, pvp, cost, ingredients) VALUES
('Estación de agua con sabores', 'complemento', 0, 0, '[]'),
('Estación de vermut y encurtidos', 'complemento', 0, 0, '[]'),
('Estación de salmorejos', 'complemento', 0, 0, '[]'),
('Estación de ahumados', 'complemento', 0, 0, '[]'),
('El rincón del vegano', 'complemento', 0, 0, '[]'),
('Estación de cervezas', 'complemento', 0, 0, '[]'),
('Estación de chacina', 'complemento', 0, 0, '[]'),
('Estación raw bar', 'complemento', 0, 0, '[]'),
('Estación de mariscos', 'complemento', 0, 0, '[]'),
('Show cooking de ostras', 'complemento', 0, 0, '[]'),
('Estación mexicana', 'complemento', 0, 0, '[]'),
('Cortador de jamón en directo', 'complemento', 0, 0, '[]'),
('Estación de cócteles', 'complemento', 0, 0, '[]'),
('Estación de arroces', 'complemento', 0, 0, '[]'),
('Estación de fritos en directo', 'complemento', 0, 0, '[]'),
('Estación de sushi', 'complemento', 0, 0, '[]'),
('Food truck', 'complemento', 0, 0, '[]'),
('Barbacoa en directo', 'complemento', 0, 0, '[]'),
('Mesa de chuches', 'complemento', 0, 0, '[]'),
('Buffet de tartas', 'complemento', 0, 0, '[]'),
('Estación de buñuelos de la abuela', 'complemento', 0, 0, '[]'),
('Planeta helado (estación de helados)', 'complemento', 0, 0, '[]'),
('Hora loca', 'complemento', 0, 0, '[]');

-- ============================================================
-- 10. SEED: PROPOSED MENUS (from PDF)
-- ============================================================
INSERT INTO proposed_menus (id, name, tag, suggested_price, is_kid, sections) VALUES
('menu1', 'Menú 1', 'Esencial', 75, false,
 '[{"section":"Aperitivos en mesa","items":["Gorditas del sur","Pan individual","Jamón","Queso","Caña de lomo","Gambas cocidas","Frito variado (4 tipos)"]},
   {"section":"Plato principal","items":["Sorbete de limón","Carrillera a baja temperatura con puré trufado"]},
   {"section":"Postre y bebida","items":["Postre del día","Cava","Cerveza con/sin","Vino tinto","Verdejo y Frizzante","Manzanilla","Refrescos","Agua"]}]'),
('menu2', 'Menú 2', 'Recomendado', 90, false,
 '[{"section":"Aperitivos fríos","items":["Gorditas del sur","Jamón ibérico 75% bellota","Selección Apolonio","Chupito andaluz de la huerta","Patatas aliñadas con ventresca","Tosta de queso payoyo","Cazuelita de revuelto ibérico"]},
   {"section":"Aperitivos calientes","items":["Choco frito","Adobo sevillano","Croquetas de cocido","Mini pita de pringá"]},
   {"section":"Plato principal","items":["Sorbete de limón","Carrillera a baja temperatura con puré trufado"]},
   {"section":"Postre y bebida","items":["Postre","Cava","Cerveza con/sin","Vino tinto","Verdejo y Frizzante","Manzanilla","Refrescos","Agua"]}]'),
('menu3', 'Menú 3', 'Completo', 100, false,
 '[{"section":"Aperitivos fríos","items":["Gorditas del sur","Jamón ibérico 75% bellota","Selección Apolonio","Chupito andaluz de la huerta","Patatas aliñadas con ventresca","Tosta de queso payoyo","Cazuelita de revuelto ibérico"]},
   {"section":"Aperitivos calientes","items":["Choco frito","Adobo sevillano","Croquetas de cocido","Mini pita de pringá"]},
   {"section":"En mesa a compartir","items":["Gambas cocidas"]},
   {"section":"Plato principal","items":["Sorbete de limón","Carrillera a baja temperatura con puré trufado"]},
   {"section":"Postre y bebida","items":["Postre","Cava","Cerveza con/sin","Vino tinto","Verdejo y Frizzante","Manzanilla","Refrescos","Agua"]}]'),
('menu4', 'Menú 4', 'Premium', 110, false,
 '[{"section":"Aperitivos fríos","items":["Gorditas del sur","Jamón ibérico 75% bellota","Selección Apolonio","Chupito andaluz","Patatas aliñadas con ventresca","Tosta queso payoyo","Cremoso de ensaladilla con huevo de codorniz","Tosta presa ibérica, queso de cabra y mermelada de pimiento"]},
   {"section":"Aperitivos calientes","items":["Choco frito","Adobo sevillano","Croquetas de cocido","Delicias de pollo con miel y mostaza","Mini pita de pringá"]},
   {"section":"Plato principal","items":["Carrillera a baja temperatura con puré trufado"]},
   {"section":"Postre y bebida","items":["Surtido de mini pastelitos","Cava","Cerveza con/sin","Vino tinto Lomas del Marquez","Verdejo y Frizzante","Manzanilla","Refrescos","Agua"]}]'),
('menu5', 'Menú 5', 'Premium +', 125, false,
 '[{"section":"Aperitivos fríos","items":["Gorditas del sur","Jamón ibérico 75% bellota","Selección Apolonio","Chupito andaluz","Patatas aliñadas con ventresca","Tosta queso payoyo","Cremoso de ensaladilla","Tosta presa ibérica","Cazuelita de revuelto ibérico"]},
   {"section":"Aperitivos calientes","items":["Choco frito","Adobo sevillano","Croquetas de cocido","Delicia de pollo con miel y mostaza","Mini pavías de bacalao","Mini pita de pringá"]},
   {"section":"Plato principal","items":["Carrillera a baja temperatura con puré trufado"]},
   {"section":"Postre y bebida","items":["Surtido de mini pastelitos","Cava","Cerveza con/sin","Vino tinto Lomas del Marquez","Verdejo y Frizzante","Manzanilla","Refrescos","Agua"]}]'),
('menu6', 'Menú 6', 'Gran Selección', 140, false,
 '[{"section":"Aperitivos fríos","items":["Gorditas del sur","Jamón ibérico 75% bellota","Selección Apolonio","Lomo mechado con AOVE","Pincho clásico de tortilla","Chupito andaluz","Patatas aliñadas con ventresca","Tosta queso payoyo","Tosta presa ibérica con mermelada de pimiento"]},
   {"section":"Aperitivos calientes","items":["Choco frito","Adobo sevillano","Croquetas de cocido","Delicia de pollo con miel y mostaza","Mini pavías de bacalao","Mini pita de pringá","Mini de solomillo al whisky"]},
   {"section":"Postre y bebida","items":["Surtido de mini pastelitos","Cava","Cerveza con/sin","Vino tinto Lomas del Marquez","Verdejo y Frizzante","Manzanilla","Refrescos","Agua"]}]'),
('kid1', 'Menú Niño 1', 'Infantil', 30, true,
 '[{"section":"Para cada 4 comensales","items":["Olivas sabor anchoas sin hueso","Patatas chips","Pan individual","Croquetas de puchero","Pinchos de tortilla"]},
   {"section":"Plato individual","items":["Media pechuga de pollo empanada, mini hamburguesa, patatas fritas y kétchup"]},
   {"section":"Postre y bebida","items":["Helado de vainilla","Refrescos","Agua","Zumos"]}]'),
('kid2', 'Menú Niño 2', 'Infantil +', 35, true,
 '[{"section":"A compartir cada 4","items":["Olivas sin hueso","Patatas chips","Pan individual","Jamón 75% ibérico de bellota","Choco","Croquetas de puchero"]},
   {"section":"Plato individual","items":["Media pechuga de pollo, mini hamburguesa, patatas fritas y kétchup"]},
   {"section":"Postre y bebida","items":["Helado de vainilla o chocolate","Zumos","Refrescos","Agua"]}]');

-- ============================================================
-- 11. VIEWS
-- ============================================================
CREATE OR REPLACE VIEW catalog_summary AS
SELECT
    id, name, category, subcategory, pvp, cost,
    ROUND(((pvp - cost) / NULLIF(pvp, 0)) * 100, 1) AS margin_pct,
    pvp - cost AS margin_abs,
    ingredients, image_url, active
FROM catalog_items;

CREATE OR REPLACE VIEW event_summary AS
SELECT
    e.id, e.menu_id, e.client_name, e.client_email, e.event_type,
    e.guest_count, e.kids_count, e.event_date, e.status,
    e.total_pvp, e.total_cost,
    e.bar_hours, e.bar_price, e.iva_pct,
    ROUND(((e.total_pvp - e.total_cost) / NULLIF(e.total_pvp, 0)) * 100, 1) AS margin_pct,
    e.total_pvp - e.total_cost AS profit_abs,
    e.selected_items, e.notes, e.created_at, e.updated_at
FROM events e;

-- ============================================================
-- 12. FUNCTION: recalc_event_totals
-- ============================================================
CREATE OR REPLACE FUNCTION recalc_event_totals(event_uuid UUID)
RETURNS VOID AS $$
DECLARE
    v_total_pvp NUMERIC(12,2) := 0;
    v_total_cost NUMERIC(12,2) := 0;
    item JSONB;
BEGIN
    FOR item IN SELECT jsonb_array_elements(selected_items) LOOP
        v_total_pvp := v_total_pvp + (item->>'subtotal_pvp')::NUMERIC(12,2);
        v_total_cost := v_total_cost + (item->>'subtotal_cost')::NUMERIC(12,2);
    END LOOP;
    UPDATE events SET total_pvp = v_total_pvp, total_cost = v_total_cost
    WHERE id = event_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. TABLE PLANS — Save editor state per event
-- ============================================================
CREATE TABLE IF NOT EXISTS table_plans (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name          TEXT NOT NULL DEFAULT 'Plano principal',
    tables_data   JSONB NOT NULL DEFAULT '[]'::jsonb,
    elements_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    budget_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
    canvas_width  NUMERIC(10,2) NOT NULL DEFAULT 2400,
    canvas_height NUMERIC(10,2) NOT NULL DEFAULT 1800,
    zoom          NUMERIC(5,2) NOT NULL DEFAULT 1,
    pan_x         NUMERIC(10,2) NOT NULL DEFAULT 100,
    pan_y         NUMERIC(10,2) NOT NULL DEFAULT 100,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_table_plans_event ON table_plans(event_id);

-- ============================================================
-- 14. ADMINS — JWT auth users
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'admin',
    active        BOOLEAN NOT NULL DEFAULT true,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RBAC (FR-R01): el rol controla qué módulos ve/usa cada usuario.
-- 4 perfiles: admin (todo), cocina, camareros (maître/sala), clientes (comercial).
UPDATE admins SET role = 'admin'
  WHERE role IS NULL OR role NOT IN ('admin','cocina','camareros','clientes');
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD CONSTRAINT admins_role_check
  CHECK (role IN ('admin','cocina','camareros','clientes'));
-- Vínculo opcional a un trabajador (cocinero/maître con login propio) — FR-R04
ALTER TABLE admins ADD COLUMN IF NOT EXISTS worker_id UUID;

-- Seed default admin (password: admin123)
INSERT INTO admins (email, name, password_hash, role)
VALUES ('admin@eventflow.app', 'Admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 15. BODALAB MODULES — clients (CRM), payments, guests, appointments
--     (también disponible como migración: scripts/bodalab-modules.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    company     TEXT,
    tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email ON clients (lower(email)) WHERE email IS NOT NULL;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE events ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS payments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    concept     TEXT NOT NULL DEFAULT 'Pago',
    amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    due_date    DATE,
    paid        BOOLEAN NOT NULL DEFAULT false,
    paid_date   DATE,
    method      TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_event ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_due ON payments(due_date) WHERE paid = false;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_payments_updated ON payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add receipt_url column for payment receipts/vouchers
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;

CREATE TABLE IF NOT EXISTS guests (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    group_name   TEXT,
    rsvp         TEXT NOT NULL DEFAULT 'pendiente' CHECK (rsvp IN ('pendiente','confirmado','rechazado')),
    menu_type    TEXT NOT NULL DEFAULT 'adulto' CHECK (menu_type IN ('adulto','nino','bebe')),
    dietary      JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id);
ALTER TABLE guests DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_guests_updated ON guests;
CREATE TRIGGER trg_guests_updated BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS appointments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'cita' CHECK (kind IN ('cita','bloqueo','nota')),
    event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
    start_date  DATE NOT NULL,
    end_date    DATE,
    start_time  TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(start_date);
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_appointments_updated ON appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 16. FASE 2: LEADS (CRM — datos básicos de contacto)
-- Separado de clients para que un lead pueda convertirse en cliente
-- con datos fiscales completos sin perder el histórico.
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    source      TEXT DEFAULT 'configurador' CHECK (source IN ('configurador','manual','web','referido','otro')),
    status      TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo','contactado','presupuestado','convertido','perdido')),
    notes       TEXT,
    event_type  TEXT,
    guest_count INT,
    event_date  DATE,
    converted_to_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_leads_updated ON leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 16b. TABLES (mapa de mesas por evento)
-- ============================================================
CREATE TABLE IF NOT EXISTS tables (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    table_number INT NOT NULL,
    x           NUMERIC(10,2) DEFAULT 0,
    y           NUMERIC(10,2) DEFAULT 0,
    capacity    INT DEFAULT 10,
    shape       TEXT DEFAULT 'circle' CHECK (shape IN ('circle','rectangle','square')),
    rotation    INT DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tables_event ON tables(event_id);
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 16b-2. MAPA DE MESAS — floorplans persistidos + auto-asignación
-- (antes solo en scripts/2026-06-22-mapa-mesas-migrate.sql, drift de esquema)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_floorplans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Salón de Celebraciones',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);
CREATE INDEX IF NOT EXISTS idx_floorplans_event ON event_floorplans(event_id);
ALTER TABLE event_floorplans DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  seat_number INT NOT NULL DEFAULT 0,
  dietary_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, table_id, guest_id)
);
CREATE INDEX IF NOT EXISTS idx_table_assignments_event ON table_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_table ON table_assignments(table_id);
ALTER TABLE table_assignments DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 16c. EVENT MENU ITEMS (escandallo por evento)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_menu_items (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    category       TEXT NOT NULL,
    quantity       INT DEFAULT 0,
    unit_price_pvp NUMERIC(10,2) DEFAULT 0,
    subtotal_pvp   NUMERIC(10,2) DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_menu_items_event ON event_menu_items(event_id);
ALTER TABLE event_menu_items DISABLE ROW LEVEL SECURITY;
-- Menú seleccionado vs sugerencia (FR-A08) + pase/service_round (FR-C06)
ALTER TABLE event_menu_items
  ADD COLUMN IF NOT EXISTS kind          TEXT NOT NULL DEFAULT 'seleccionado'
    CHECK (kind IN ('seleccionado','sugerencia')),
  ADD COLUMN IF NOT EXISTS service_round INT NOT NULL DEFAULT 1;

-- Add operations_generated_at to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS operations_generated_at TIMESTAMPTZ;
-- stock_deducted: idempotency flag for /api/stock/deduct (was referenced by the
-- deduct route but never defined → 500 on a clean DB).
ALTER TABLE events ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;
-- Orden de pases personalizado por evento (hojas de cocina) — estaba en migraciones.
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_pass_order JSONB;
-- Ubicación del evento (FR-A07/A11): condiciona el módulo Cocina (carga/logística)
-- y el mapa de mesas (plano propio vs PDF del venue externo).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_type    TEXT NOT NULL DEFAULT 'benitez'
    CHECK (venue_type IN ('benitez','externo')),
  ADD COLUMN IF NOT EXISTS location      TEXT,
  ADD COLUMN IF NOT EXISTS venue_pdf_url TEXT;
-- Máquina de estados de transiciones (scripts/2026-operativa-migration.sql):
-- las usa src/app/api/events/[id]/transitions (INV-1..INV-5). Sin ellas ese
-- endpoint da 500 al cancelar/perder/reabrir un evento.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cancelled_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by    TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason   TEXT,
  ADD COLUMN IF NOT EXISTS lost_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_reason     TEXT,
  ADD COLUMN IF NOT EXISTS reopened_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_by     TEXT,
  ADD COLUMN IF NOT EXISTS reopen_reason   TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_previo JSONB;
-- ============================================================
-- 17. QUOTES (Presupuestos) — ciclo de vida del precio
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
    lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired','historical')),
    items           JSONB NOT NULL DEFAULT '[]'::jsonb,
    base_pvp        NUMERIC(12,2) NOT NULL DEFAULT 0,
    base_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
    bar_price       NUMERIC(10,2) NOT NULL DEFAULT 0,
    extras_pvp      NUMERIC(12,2) NOT NULL DEFAULT 0,
    extras_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
    iva_pct         NUMERIC(5,2) NOT NULL DEFAULT 10,
    total_pvp       NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
    margin_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
    valid_until     DATE,
    sent_at         TIMESTAMPTZ,
    accepted_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_event ON quotes(event_id);
CREATE INDEX IF NOT EXISTS idx_quotes_lead ON quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
-- Motivo obligatorio al cancelar/rechazar un presupuesto (FR-A03)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_quotes_updated ON quotes;
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 18. EVENT ORDERS (Órdenes confirmadas)
-- Una vez el presupuesto es aceptado, se genera una orden
-- que es la entidad operativa para el ERP.
-- ============================================================
CREATE TABLE IF NOT EXISTS event_orders (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    quote_id            UUID NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT,
    client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
    confirmed_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
    final_price         NUMERIC(12,2) NOT NULL DEFAULT 0,  -- incluye consumos extra
    status              TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled','reopened')),
    extra_consumptions  JSONB NOT NULL DEFAULT '[]'::jsonb,
    tables_suggested    INT NOT NULL DEFAULT 0,
    tables_confirmed    INT NOT NULL DEFAULT 0,
    waiters_suggested   INT NOT NULL DEFAULT 0,
    waiters_confirmed   INT NOT NULL DEFAULT 0,
    completed_at        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_orders_event ON event_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_client ON event_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_status ON event_orders(status);
ALTER TABLE event_orders DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_event_orders_updated ON event_orders;
CREATE TRIGGER trg_event_orders_updated BEFORE UPDATE ON event_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 19. INVOICES (Facturas) — inmutables una vez generadas
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_order_id  UUID NOT NULL REFERENCES event_orders(id) ON DELETE RESTRICT,
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
    invoice_number  TEXT NOT NULL UNIQUE,
    fiscal_name     TEXT NOT NULL,
    fiscal_nif      TEXT NOT NULL,
    fiscal_address  TEXT,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    iva_pct         NUMERIC(5,2) NOT NULL DEFAULT 10,
    iva_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    total           NUMERIC(12,2) NOT NULL DEFAULT 0,
    extras_pvp      NUMERIC(12,2) NOT NULL DEFAULT 0,
    payments_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
    balance_due     NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
    paid_at         TIMESTAMPTZ,
    pdf_data        TEXT,  -- base64 del PDF
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(event_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
-- Factura rectificativa → factura original (scripts/2026-operativa-migration.sql).
-- La usa la transición INV-4 (reabrir evento) al emitir rectificativa.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rectificativa_of UUID REFERENCES invoices(id);
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 20. INGREDIENTS (Materias primas — ENTIDAD ÚNICA)
-- ============================================================
-- Tabla canónica única de ingredientes (FR-S05). Antes existían DOS
-- definiciones `ingredients` en este fichero (drift de esquema) que
-- chocaban con `CREATE TABLE IF NOT EXISTS`. Esta es la única válida.
--
-- Coste único (FR-S02): tres subsistemas históricos escriben el coste con
-- nombres distintos — stock usa `cost_per_unit`, escandallo/OCR usan
-- `current_price`, costing usa `unit_cost`. El trigger `sync_ingredient_cost`
-- mantiene las tres columnas en lockstep para que toda lectura vea el mismo
-- número. `unit_cost` es la columna canónica.
CREATE TABLE IF NOT EXISTS ingredients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    category        TEXT NOT NULL DEFAULT 'general',
    unit            TEXT NOT NULL DEFAULT 'g',
    unit_cost       NUMERIC(12,4) NOT NULL DEFAULT 0,   -- canónica (€/unidad base)
    cost_per_unit   NUMERIC(12,4) NOT NULL DEFAULT 0,   -- alias legacy (stock)
    current_price   NUMERIC(12,4) NOT NULL DEFAULT 0,   -- alias legacy (escandallo/OCR)
    pvp_ratio       NUMERIC(5,4)  NOT NULL DEFAULT 1.0,
    stock_unit      TEXT NOT NULL DEFAULT 'g',
    packaging_size  NUMERIC(10,2),
    quantity        NUMERIC(12,2) NOT NULL DEFAULT 0,   -- stock actual
    min_stock       NUMERIC(12,2) NOT NULL DEFAULT 0,
    supplier        TEXT,
    supplier_id     UUID,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
ALTER TABLE ingredients DISABLE ROW LEVEL SECURITY;
-- Clasificación para la Hoja Logística (FR-C07): equipamiento (se transporta,
-- no se compra) y producto seco/no perecedero, separados de los perecederos.
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS is_equipment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_dry       BOOLEAN NOT NULL DEFAULT false;
-- Marca de última reposición manual de stock (usada por /api/stock GET/PUT).
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS last_restocked TIMESTAMPTZ;
DROP TRIGGER IF EXISTS trg_ingredients_updated ON ingredients;
CREATE TRIGGER trg_ingredients_updated BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Coste único: mantiene unit_cost = cost_per_unit = current_price (FR-S02)
CREATE OR REPLACE FUNCTION sync_ingredient_cost() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.unit_cost := COALESCE(NULLIF(NEW.unit_cost, 0), NULLIF(NEW.cost_per_unit, 0), NULLIF(NEW.current_price, 0), 0);
  ELSE
    -- En UPDATE, propaga la columna que haya cambiado a la canónica.
    IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost THEN
      NEW.unit_cost := NEW.unit_cost;
    ELSIF NEW.cost_per_unit IS DISTINCT FROM OLD.cost_per_unit THEN
      NEW.unit_cost := NEW.cost_per_unit;
    ELSIF NEW.current_price IS DISTINCT FROM OLD.current_price THEN
      NEW.unit_cost := NEW.current_price;
    END IF;
  END IF;
  NEW.cost_per_unit := NEW.unit_cost;
  NEW.current_price := NEW.unit_cost;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_ingredients_sync_cost ON ingredients;
CREATE TRIGGER trg_ingredients_sync_cost BEFORE INSERT OR UPDATE ON ingredients
    FOR EACH ROW EXECUTE FUNCTION sync_ingredient_cost();

-- ============================================================
-- 20b. Tablas operativas adicionales (cocina, trazabilidad, mapa-mesas,
--      briefings, APPCC) — antes vivían solo en scripts/*.sql (drift).
-- ============================================================

-- 20b.1 SUPPLIER ORDERS (Pedidos a proveedor) — autoría desde código vivo,
-- no existía CREATE TABLE en ningún migration script. Columnas inferidas de
-- src/app/api/stock/supplier-orders, generate-order, auto-orders, ocr/apply
-- y src/app/api/trazabilidad/receiving/from-order.
CREATE TABLE IF NOT EXISTS supplier_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
    supplier        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','delivered','received','partial','cancelled')),
    total_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
    origin          TEXT DEFAULT 'manual',
    notes           TEXT,
    expected_date   DATE,
    delivered_date  DATE,
    ordered_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON supplier_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_event ON supplier_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier ON supplier_orders(supplier);
ALTER TABLE supplier_orders DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_supplier_orders_updated ON supplier_orders;
CREATE TRIGGER trg_supplier_orders_updated BEFORE UPDATE ON supplier_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS supplier_order_items (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id           UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
    ingredient_id      UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    ingredient_name    TEXT NOT NULL,
    quantity           NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit               TEXT NOT NULL DEFAULT 'ud',
    unit_cost          NUMERIC(10,4) NOT NULL DEFAULT 0,
    cost_per_unit       NUMERIC(10,4) NOT NULL DEFAULT 0,  -- alias usado por /api/stock/generate-order
    received_quantity  NUMERIC(12,3) NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_order ON supplier_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_ingredient ON supplier_order_items(ingredient_id);
ALTER TABLE supplier_order_items DISABLE ROW LEVEL SECURITY;

-- 20b.2 INVENTORY / INVENTORY MOVEMENTS — scripts/2026-06-22-trazabilidad-migrate-v1.sql
CREATE TABLE IF NOT EXISTS inventory (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id     UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity          NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit              TEXT NOT NULL DEFAULT 'g',
    min_stock         NUMERIC(12,3) DEFAULT 0,
    last_movement_at TIMESTAMPTZ,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    UNIQUE(ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_ingredient ON inventory(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_min ON inventory(min_stock);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id      UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    movement_type     TEXT NOT NULL CHECK (movement_type IN ('receipt','consumption','adjustment','expiry','transfer')),
    quantity          NUMERIC(12,3) NOT NULL,
    unit              TEXT NOT NULL DEFAULT 'g',
    reference_type    TEXT,
    reference_id      UUID,
    previous_stock    NUMERIC(12,3) NOT NULL,
    new_stock         NUMERIC(12,3) NOT NULL,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movements_inventory ON inventory_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_date ON inventory_movements(created_at);

CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_inventory_updated ON inventory;
CREATE TRIGGER trg_inventory_updated
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamp();

-- 20b.3 INGREDIENT PRICE HISTORY — scripts/migration-escandallos-v2.sql (E3)
CREATE TABLE IF NOT EXISTS ingredient_price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  old_price       NUMERIC(10,4),
  new_price       NUMERIC(10,4) NOT NULL,
  changed_by      VARCHAR(100) DEFAULT 'system',
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_history_ingredient ON ingredient_price_history(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON ingredient_price_history(recorded_at DESC);

-- 20b.4 RECIPE TEMPLATES — scripts/migration-escandallos-v2.sql (E1)
CREATE TABLE IF NOT EXISTS recipe_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  category    VARCHAR(50) NOT NULL DEFAULT 'general',
  base_pax    INTEGER NOT NULL DEFAULT 50,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_template_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id        UUID NOT NULL REFERENCES recipe_templates(id) ON DELETE CASCADE,
  ingredient_name  VARCHAR(200) NOT NULL,
  quantity_per_pax NUMERIC(10,3) NOT NULL DEFAULT 0,
  unit             VARCHAR(20) NOT NULL DEFAULT 'g',
  provider_name    VARCHAR(200),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipe_template_items_recipe ON recipe_template_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_templates_category ON recipe_templates(category);

-- 20b.5 AUDIT LOG — scripts/2026-operativa-migration.sql.
-- Toda transición de estado (FR-A03/A04...) se registra aquí de forma atómica.
-- La usa src/app/api/events/[id]/transitions; sin esta tabla ese endpoint da 500
-- en una BD recién creada.
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  lead_id       UUID REFERENCES leads(id) ON DELETE SET NULL,
  entity_type   TEXT NOT NULL,          -- 'event', 'lead', 'quote', 'payment', 'invoice'
  entity_id     UUID NOT NULL,
  action        TEXT NOT NULL,          -- 'FWD-1', 'INV-3', etc.
  from_status   TEXT,
  to_status     TEXT,
  actor         TEXT,                   -- username or 'system'
  actor_role    TEXT,                   -- 'admin', 'client', 'system'
  motivo        TEXT,                   -- reason for inverse transitions
  metadata      JSONB DEFAULT '{}',     -- extra data (amounts, diffs, etc.)
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- 20b.6 UNITS OF MEASURE — scripts/migration-escandallos-v2.sql.
-- Catálogo de unidades + factor a la base (peso/volumen/unidad). La usa
-- src/app/api/stock/uom; sin ella ese endpoint da 500 en una BD nueva.
CREATE TABLE IF NOT EXISTS units_of_measure (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(20) NOT NULL UNIQUE,
  category       VARCHAR(20) NOT NULL,  -- weight, volume, unit
  factor_to_base NUMERIC(10,4) NOT NULL DEFAULT 1,
  symbol         VARCHAR(10),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO units_of_measure (name, category, factor_to_base, symbol) VALUES
  ('kg', 'weight', 1, 'kg'),
  ('g', 'weight', 0.001, 'g'),
  ('l', 'volume', 1, 'L'),
  ('ml', 'volume', 0.001, 'ml'),
  ('ud', 'unit', 1, 'ud')
ON CONFLICT (name) DO NOTHING;
ALTER TABLE units_of_measure DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 21. RECIPE ITEMS (Relación plato-ingrediente con cantidad)
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity        NUMERIC(10,2) NOT NULL DEFAULT 0,  -- en la unidad del ingrediente
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipe_catalog ON recipe_items(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient ON recipe_items(ingredient_id);
ALTER TABLE recipe_items DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 21b. COCINA — pases de servicio, equipamiento y recetas
-- (antes solo en scripts/2026-06-22-cocina-migrate-v1.sql, drift de esquema)
-- ============================================================

-- service_passes — Pases de servicio por defecto
CREATE TABLE IF NOT EXISTS service_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_number INT NOT NULL,
    name TEXT NOT NULL,
    icon VARCHAR(10) DEFAULT '🍽️',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO service_passes (pass_number, name, icon, sort_order)
SELECT * FROM (VALUES
    (1, 'Aperitivos y entrantes', '🥟', 1),
    (2, 'Mesas y compartidos', '🥘', 2),
    (3, 'Principal', '🥩', 3),
    (4, 'Dulce y final', '🍰', 4),
    (5, 'Bebidas', '🥂', 5),
    (99, 'Complementos', '🧂', 99)
) AS v(pass_number, name, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM service_passes);

-- category_pass_mapping — Mapeo categoría de plato → pase por defecto
CREATE TABLE IF NOT EXISTS category_pass_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL UNIQUE,
    pass_id UUID NOT NULL REFERENCES service_passes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO category_pass_mapping (category, pass_id) VALUES
    ('aperitivo-frio',    (SELECT id FROM service_passes WHERE pass_number = 1)),
    ('aperitivo-caliente',(SELECT id FROM service_passes WHERE pass_number = 1)),
    ('compartir-mesa',    (SELECT id FROM service_passes WHERE pass_number = 2)),
    ('arroz',             (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('carne',             (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('pescado',           (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('sorbete',           (SELECT id FROM service_passes WHERE pass_number = 4)),
    ('postre',            (SELECT id FROM service_passes WHERE pass_number = 4)),
    ('bebida',            (SELECT id FROM service_passes WHERE pass_number = 5)),
    ('complemento',       (SELECT id FROM service_passes WHERE pass_number = 99))
ON CONFLICT (category) DO NOTHING;

-- equipment — Catálogo de equipamiento con stock
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('utensilio','vajilla','maquinaria','textil','mobiliario','descartable')),
    unit TEXT NOT NULL DEFAULT 'ud',
    stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(10,2) DEFAULT 0,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_active ON equipment(active);

-- equipment_rules — Qué equipamiento necesita cada plato/categoría
CREATE TABLE IF NOT EXISTS equipment_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT,
    catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity_per_use NUMERIC(10,2) NOT NULL DEFAULT 1,
    per_guest BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eq_rules_category ON equipment_rules(category);
CREATE INDEX IF NOT EXISTS idx_eq_rules_catalog ON equipment_rules(catalog_item_id);

-- recipes — Recetas subidas (vinculadas a catálogo)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual','excel','pdf','scanned')),
    source_file TEXT,
    servings INT DEFAULT 1,
    category TEXT,
    catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    ingredients JSONB DEFAULT '[]'::jsonb,
    instructions TEXT,
    prep_time INT,
    cook_time INT,
    difficulty TEXT DEFAULT 'media' CHECK (difficulty IN ('facil','media','dificil')),
    version INT NOT NULL DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON recipes(active);
CREATE INDEX IF NOT EXISTS idx_recipes_catalog ON recipes(catalog_item_id);

CREATE OR REPLACE FUNCTION update_equipment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_equipment_updated ON equipment;
CREATE TRIGGER trg_equipment_updated
    BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_equipment_timestamp();

CREATE OR REPLACE FUNCTION update_recipes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_recipes_updated ON recipes;
CREATE TRIGGER trg_recipes_updated
    BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_recipes_timestamp();

-- ============================================================
-- 22. AUTOMATION RULES (triggered by webhook events)
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    trigger_topic   TEXT NOT NULL,
    match_type      TEXT NOT NULL DEFAULT 'all' CHECK (match_type IN ('all','any')),
    conditions      JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions         JSONB NOT NULL DEFAULT '[]'::jsonb,
    cooldown_minutes INT NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    trigger_count   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_rules_topic ON automation_rules(trigger_topic);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(enabled);
ALTER TABLE automation_rules DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_automation_rules_updated ON automation_rules;
CREATE TRIGGER trg_automation_rules_updated BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Automation rule execution logs
CREATE TABLE IF NOT EXISTS automation_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id         UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    rule_name       TEXT NOT NULL,
    event_id        UUID REFERENCES events(id),
    topic           TEXT NOT NULL,
    conditions_met  BOOLEAN NOT NULL DEFAULT false,
    actions_taken   JSONB DEFAULT '[]'::jsonb,
    success         BOOLEAN NOT NULL DEFAULT true,
    error_message   TEXT,
    execution_ms    INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_event ON automation_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC);
ALTER TABLE automation_logs DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 23. (ELIMINADA) staff_assignments — tabla duplicada, reemplazada por staffing_assignments
-- ============================================================

-- ============================================================
-- 23b. STOCK ENTRIES (Movimientos de stock trazados)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id   UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
    quantity        NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit            TEXT DEFAULT 'g',
    movement_reason TEXT NOT NULL DEFAULT 'operativo'
        CHECK (movement_reason IN ('operativo','compra_prevision','merma','ajuste_inventario','inventario_inicial')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 23c. UPDATE event STATUS ENUM (máquina de estados extendida)
-- Primero actualizar el CHECK constraint (permitir ambos sets)
-- Luego migrar datos existentes
-- Finalmente restringir el CHECK a los nuevos valores
-- ============================================================
-- Paso 1: Eliminar el CHECK existente para poder migrar
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;

-- Paso 2: Permitir temporalmente todos los estados posibles
ALTER TABLE events ADD CONSTRAINT events_status_check_temp
    CHECK (status IN ('nuevo','propuesta_enviada','confirmado','cancelado','en_curso','completado','draft','sent','accepted','in_progress','completed','paid','cancelled'));

-- Paso 3: Migrar datos existentes
UPDATE events SET status = 'draft' WHERE status = 'nuevo';
UPDATE events SET status = 'sent' WHERE status = 'propuesta_enviada';
UPDATE events SET status = 'accepted' WHERE status = 'confirmado';
UPDATE events SET status = 'in_progress' WHERE status = 'en_curso';
UPDATE events SET status = 'completed' WHERE status = 'completado';
UPDATE events SET status = 'cancelled' WHERE status = 'cancelado';

-- Paso 4: Eliminar el CHECK temporal y aplicar el definitivo
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check_temp;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
-- Incluye 'lost' y 'reopened' (scripts/2026-operativa-migration.sql): la máquina
-- de transiciones INV-1 (→lost) e INV-4 (→reopened) los necesita.
ALTER TABLE events ADD CONSTRAINT events_status_check
    CHECK (status IN ('draft','sent','accepted','in_progress','completed','paid','cancelled','lost','reopened'));

-- ============================================================
-- 24. EXTEND client TABLE con datos fiscales
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fiscal_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fiscal_nif TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fiscal_address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

-- ============================================================
-- 25. TRIGGER: auto-calculate totals en quotes
-- ============================================================
CREATE OR REPLACE FUNCTION calc_quote_totals()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_pvp := NEW.base_pvp + NEW.bar_price + NEW.extras_pvp;
    NEW.total_cost := NEW.base_cost + NEW.extras_cost;
    NEW.margin_pct := CASE
        WHEN NEW.total_pvp > 0 THEN ROUND(((NEW.total_pvp - NEW.total_cost) / NEW.total_pvp) * 100, 2)
        ELSE 0
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_calc ON quotes;
CREATE TRIGGER trg_quote_calc BEFORE INSERT OR UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION calc_quote_totals();

-- ============================================================
-- 26. TRIGGER: auto-create lead from events table on insert
-- ============================================================
CREATE OR REPLACE FUNCTION auto_create_lead()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO leads (name, email, phone, source, status, event_type, guest_count, event_date)
    VALUES (NEW.client_name, NEW.client_email, NEW.client_phone, 'configurador', 'nuevo', NEW.event_type, NEW.guest_count, NEW.event_date);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_create_lead ON events;
CREATE TRIGGER trg_event_create_lead AFTER INSERT ON events
    FOR EACH ROW EXECUTE FUNCTION auto_create_lead();

-- ============================================================
-- 27. VIEW: shopping list (escandallo)
-- ============================================================
DROP VIEW IF EXISTS shopping_list;
CREATE VIEW shopping_list AS
WITH event_items AS (
    SELECT
        eo.event_id,
        eo.id AS order_id,
        jsonb_array_elements(e.selected_items) AS item
    FROM event_orders eo
    JOIN events e ON e.id = eo.event_id
    WHERE eo.status IN ('in_progress', 'completed')
),
item_details AS (
    SELECT
        ei.event_id,
        ei.order_id,
        COALESCE(NULLIF(ei.item->>'name', ''), ei.item->>'item_id')::TEXT AS item_name,
        (ei.item->>'category')::TEXT AS category,
        (ei.item->>'quantity')::NUMERIC AS item_qty
    FROM event_items ei
),
ingredient_breakdown AS (
    SELECT
        id.event_id,
        id.order_id,
        id.item_qty,
        ci.id AS catalog_id,
        (ing->>'name')::TEXT AS ingredient_name,
        (ing->>'grams')::NUMERIC AS grams,
        (ing->>'count')::NUMERIC AS count,
        (ing->>'ml')::NUMERIC AS ml
    FROM item_details id
    JOIN catalog_items ci ON ci.name = id.item_name
    CROSS JOIN LATERAL jsonb_array_elements(ci.ingredients) AS ing

    UNION ALL

    -- Items without catalog match → use item name as ingredient (1 unit)
    SELECT
        id.event_id,
        id.order_id,
        id.item_qty,
        NULL::UUID AS catalog_id,
        id.item_name AS ingredient_name,
        0::NUMERIC AS grams,
        1::NUMERIC AS count,
        0::NUMERIC AS ml
    FROM item_details id
    WHERE NOT EXISTS (
        SELECT 1 FROM catalog_items ci WHERE ci.name = id.item_name
    )
    AND id.item_name IS NOT NULL
)
SELECT
    ib.event_id,
    ib.order_id,
    ib.ingredient_name,
    MAX(COALESCE(ing_stock.supplier, '—'))::TEXT AS provider_name,
    ROUND(SUM(COALESCE(ib.grams, 0) * ib.item_qty), 2) AS total_grams,
    ROUND(SUM(COALESCE(ib.count, 0) * ib.item_qty), 0) AS total_units,
    ROUND(SUM(COALESCE(ib.ml, 0) * ib.item_qty), 2) AS total_ml,
    CASE
        WHEN SUM(COALESCE(ib.grams, 0)) > 0 THEN 'mass'::TEXT
        WHEN SUM(COALESCE(ib.ml, 0)) > 0 THEN 'volume'::TEXT
        ELSE 'count'::TEXT
    END AS unit_dimension
FROM ingredient_breakdown ib
LEFT JOIN ingredients ing_stock ON lower(trim(ing_stock.name)) = lower(trim(ib.ingredient_name))
GROUP BY ib.event_id, ib.order_id, ib.ingredient_name
ORDER BY ib.ingredient_name;

-- Floor plan / table map
CREATE TABLE IF NOT EXISTS floor_plans (
  layout_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_data JSONB NOT NULL,
  label       TEXT NOT NULL DEFAULT 'Default hall layout',
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE floor_plans DISABLE ROW LEVEL SECURITY;


-- Event planning / Día D checklist
CREATE TABLE IF NOT EXISTS event_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    planned_time TEXT,
    completed BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_plans_event ON event_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_event_plans_category ON event_plans(event_id, category);
ALTER TABLE event_plans DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 28. PROVIDERS (Proveedores — CRM de suministros)
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    category      TEXT NOT NULL CHECK (category IN (
        'catering', 'decoracion', 'flores', 'fotografia', 'video',
        'musica', 'animacion', 'transporte', 'vestido', 'reposteria',
        'extras', 'otro'
    )),
    contact_name  TEXT,
    phone         TEXT,
    email         TEXT,
    notes         TEXT,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_providers_category ON providers(category);
CREATE INDEX IF NOT EXISTS idx_providers_active ON providers(active);
ALTER TABLE providers DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_providers_updated ON providers;
CREATE TRIGGER trg_providers_updated BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Facturas/deuda de proveedores (FR-A10): cuentas a pagar con vencimientos y justificante.
CREATE TABLE IF NOT EXISTS provider_invoices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID REFERENCES providers(id) ON DELETE CASCADE,
    concept      TEXT,
    amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    issue_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date     DATE,
    status       TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagado','vencido')),
    proof_url    TEXT,                       -- justificante (PDF/imagen)
    paid_at      TIMESTAMPTZ,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_provider ON provider_invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_status ON provider_invoices(status);
ALTER TABLE provider_invoices DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_provider_invoices_updated ON provider_invoices;
CREATE TRIGGER trg_provider_invoices_updated BEFORE UPDATE ON provider_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 29. GUEST FORMS (Formularios de lista de invitados)
-- ============================================================
CREATE TABLE IF NOT EXISTS guest_forms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    client_name TEXT,
    email       TEXT,
    guests      JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_forms_event ON guest_forms(event_id);
ALTER TABLE guest_forms DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_guest_forms_updated ON guest_forms;
CREATE TRIGGER trg_guest_forms_updated BEFORE UPDATE ON guest_forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 30. EVENTS.client_token (enlace único para formulario invitados)
-- ============================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_client_token ON events(client_token) WHERE client_token IS NOT NULL;

-- ============================================================
-- 31. EVENT SHOPPING ITEMS (Escandallo / lista de compras)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_shopping_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    order_id        UUID REFERENCES event_orders(id) ON DELETE SET NULL,
    ingredient_name TEXT NOT NULL,
    provider_name   TEXT,
    total_grams     NUMERIC(10,2) DEFAULT 0,
    total_units     INT DEFAULT 0,
    total_ml        NUMERIC(10,2) DEFAULT 0,
    unit_dimension  TEXT CHECK (unit_dimension IN ('mass', 'volume', 'count', 'currency')),
    completed       BOOLEAN NOT NULL DEFAULT false,
    actual_cost     NUMERIC(10,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shopping_event ON event_shopping_items(event_id);
ALTER TABLE event_shopping_items DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_shopping_updated ON event_shopping_items;
CREATE TRIGGER trg_shopping_updated BEFORE UPDATE ON event_shopping_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ingredient_id column for unified ingredient reference
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS ingredient_id UUID;

-- ============================================================
-- 31b. INGREDIENTS — definición ÚNICA arriba (sección 20). Se eliminó el
-- duplicado que aquí redefinía la tabla (drift de esquema + FK a `suppliers`
-- inexistente). Toda columna usada por el código vive en la tabla canónica.
-- ============================================================

-- ============================================================
-- 31c. EVENT COSTS (Coste centralizado por evento)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    order_id UUID REFERENCES event_orders(id) ON DELETE SET NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    ingredient_name TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'g',
    unit_cost NUMERIC(8,4) NOT NULL DEFAULT 0,
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_costs_event ON event_costs(event_id);
ALTER TABLE event_costs DISABLE ROW LEVEL SECURITY;

-- Vista unificada de costes
CREATE OR REPLACE VIEW v_event_cost AS
SELECT 
    e.id AS event_id,
    jsonb_agg(
        json_build_object(
            'ingredient_id', ec.ingredient_id,
            'ingredient_name', ec.ingredient_name,
            'quantity', ec.quantity,
            'unit', ec.unit,
            'unit_cost', ec.unit_cost,
            'line_total', ec.line_total
        )
    ) AS lines,
    SUM(ec.line_total) AS total_cost
FROM events e
LEFT JOIN event_costs ec ON ec.event_id = e.id
GROUP BY e.id;

-- ============================================================
-- 32. WAITERS (Camareros del salón)
-- ============================================================
CREATE TABLE IF NOT EXISTS waiters (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    role       TEXT DEFAULT 'camarero',
    phone      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE waiters DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 32b. BRIEFINGS DE CAMAREROS — documento operativo previo al evento
-- (antes en scripts/2026-06-23-briefings-migrate.sql y -briefings.sql;
--  se usa la forma final extendida, drift de esquema)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_briefings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by  TEXT,
  version       INT NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','archived')),
  sent_at       TIMESTAMPTZ,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_briefings_event ON event_briefings(event_id);
CREATE INDEX IF NOT EXISTS idx_briefings_status ON event_briefings(status);
ALTER TABLE event_briefings DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 32c. ORPHAN TABLES — referenciadas por código vivo pero sin DDL en
-- ningún script (autoría desde uso real, ver código citado en cada una).
-- ============================================================

-- email_queue — src/lib/email.ts, src/app/api/cron/post-event-followup,
-- src/app/api/cron/pre-event-reminders
CREATE TABLE IF NOT EXISTS email_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    recipient_name  TEXT,
    subject         TEXT NOT NULL,
    body            TEXT NOT NULL,
    email_type      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    message_id      TEXT,
    error_message   TEXT,
    scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_event ON email_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_for) WHERE status = 'pending';
ALTER TABLE email_queue DISABLE ROW LEVEL SECURITY;

-- checklist_templates / checklist_tasks — src/app/api/checklist/route.ts,
-- src/app/api/checklist/init/route.ts, src/app/api/hoja-operacion/[eventId];
-- ver también scripts/seed-checklist-templates.sql para el shape esperado.
CREATE TABLE IF NOT EXISTS checklist_templates (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type   TEXT NOT NULL,
    sort_order   INT NOT NULL DEFAULT 0,
    title        TEXT NOT NULL,
    description  TEXT,
    hours_before INT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_type ON checklist_templates(event_type);
ALTER TABLE checklist_templates DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS checklist_tasks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    template_id  UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
    title        TEXT NOT NULL,
    description  TEXT,
    hours_before INT,
    sort_order   INT NOT NULL DEFAULT 0,
    completed    BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    custom       BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_event ON checklist_tasks(event_id);
ALTER TABLE checklist_tasks DISABLE ROW LEVEL SECURITY;

-- business_settings — src/app/api/settings/route.ts, src/lib/email.ts
CREATE TABLE IF NOT EXISTS business_settings (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name      TEXT NOT NULL DEFAULT 'J.Benitez',
    address            TEXT,
    cif                TEXT,
    phone              TEXT,
    email              TEXT,
    logo_url           TEXT,
    bar_price_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
    iva_pct            NUMERIC(5,2) NOT NULL DEFAULT 10,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE business_settings DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_business_settings_updated ON business_settings;
CREATE TRIGGER trg_business_settings_updated BEFORE UPDATE ON business_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Fila única de configuración (GET/PUT siempre operan sobre "LIMIT 1").
INSERT INTO business_settings (business_name, address)
SELECT 'J.Benitez', 'Sevilla'
WHERE NOT EXISTS (SELECT 1 FROM business_settings);

-- uniform_catalog — src/app/api/staffing/uniforms/route.ts
CREATE TABLE IF NOT EXISTS uniform_catalog (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT,
    gender      TEXT NOT NULL DEFAULT 'unisex',
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uniform_catalog_active ON uniform_catalog(active);
ALTER TABLE uniform_catalog DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 33. PERFORMANCE INDEXES (P1 audit)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_client ON events(client_id);

-- ============================================================
-- 16. STAFFING MODULE — workers, staffing_lines, offers, assignments
--     (también disponible como migración: scripts/migration-staffing.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  default_uniform TEXT,
  availability JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workers_roles ON workers USING GIN (roles);
CREATE INDEX IF NOT EXISTS idx_workers_active ON workers (active) WHERE active = true;
ALTER TABLE workers DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS staffing_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  slots_needed INTEGER NOT NULL DEFAULT 1,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  uniform TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staffing_lines_event ON staffing_lines (event_id);
CREATE INDEX IF NOT EXISTS idx_staffing_lines_status ON staffing_lines (status);
ALTER TABLE staffing_lines DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS staffing_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staffing_line_id UUID NOT NULL REFERENCES staffing_lines(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'rejected', 'expired')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staffing_offers_line ON staffing_offers (staffing_line_id);
CREATE INDEX IF NOT EXISTS idx_staffing_offers_worker ON staffing_offers (worker_id);
CREATE INDEX IF NOT EXISTS idx_staffing_offers_status ON staffing_offers (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_offers_unique ON staffing_offers (staffing_line_id, worker_id);
ALTER TABLE staffing_offers DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS staffing_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staffing_line_id UUID NOT NULL REFERENCES staffing_lines(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES staffing_offers(id),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staffing_assignments_line ON staffing_assignments (staffing_line_id);
CREATE INDEX IF NOT EXISTS idx_staffing_assignments_worker ON staffing_assignments (worker_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_assignments_unique ON staffing_assignments (staffing_line_id, worker_id);
ALTER TABLE staffing_assignments DISABLE ROW LEVEL SECURITY;

-- Pago por trabajador y evento (nómina) — antes solo referenciada por el código.
-- FR-A09: pago TOTAL por trabajador + firma tras el pago (signature_url/signed_*).
CREATE TABLE IF NOT EXISTS worker_event_pay (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id     UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    hours         NUMERIC(6,2) NOT NULL DEFAULT 0,
    hourly_rate   NUMERIC(8,2) NOT NULL DEFAULT 0,
    total_pay     NUMERIC(10,2) NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'pending',  -- pending | paid
    paid_at       TIMESTAMPTZ,
    signature_url TEXT,        -- firma del trabajador (tras el pago)
    signed_at     TIMESTAMPTZ,
    signed_by     TEXT,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_worker_event_pay_event ON worker_event_pay(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_event_pay_unique ON worker_event_pay(worker_id, event_id);
ALTER TABLE worker_event_pay DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_worker_event_pay_updated ON worker_event_pay;
CREATE TRIGGER trg_worker_event_pay_updated BEFORE UPDATE ON worker_event_pay
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 28. ESCANDALLO — Receta como fuente de verdad
-- ============================================================

-- recipe_items already defined above (section X)
-- Already exists from earlier migration

-- ============================================================
-- 28b. EVENT COST DEVIATIONS (Desviación final del evento)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_cost_deviations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    estimated_total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    actual_total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    deviation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    deviation_pct NUMERIC(5,2),
    closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);
-- Un único snapshot de desviación por evento (para upsert en el cierre, FR-C03)
CREATE UNIQUE INDEX IF NOT EXISTS ux_event_cost_deviations_event ON event_cost_deviations(event_id);

-- ============================================================
-- 28c. RECIPE ITEM VERSIONS (Histórico de versiones)
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_item_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_item_id UUID NOT NULL REFERENCES recipe_items(id) ON DELETE CASCADE,
    version INT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,
    unit VARCHAR(20),
    unit_dimension TEXT,
    changed_by TEXT DEFAULT 'system',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

-- ============================================================
-- 28d. INGREDIENT PRICE HISTORY (ya existe, añadimos trigger)
-- ============================================================
-- Trigger ya creado en migración V2
-- Solo falta añadirlo al schema.sql para referencia

ALTER TABLE recipe_items
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_note TEXT,
  ADD COLUMN IF NOT EXISTS unit VARCHAR(10) DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS unit_dimension TEXT CHECK (unit_dimension IN ('mass','volume','count')),
  ADD COLUMN IF NOT EXISTS quantity_override NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE event_shopping_items
  ADD COLUMN IF NOT EXISTS recipe_item_id UUID REFERENCES recipe_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipe_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS theoretical_qty NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS theoretical_unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS theoretical_unit_dimension TEXT CHECK (theoretical_unit_dimension IN ('mass','volume','count')),
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS actual_cost_total NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS deviation_qty NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS deviation_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
  -- Lado "real" del escandallo teórico↔real (FR-C01): consumo registrado el día.
  ADD COLUMN IF NOT EXISTS actual_quantity NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS actual_unit TEXT,
  -- Categoría del plato de origen (para agrupar por pase en las hojas de cocina).
  ADD COLUMN IF NOT EXISTS category TEXT,
  -- Coste unitario y notas (scripts/migration-escandallos-v2.sql); notes lo usa
  -- /api/shopping y /api/stock/escandallos.
  ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- FK circular events <-> quotes (añadida al final, ambas tablas ya existen)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'events_quote_id_fkey' AND table_name = 'events'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- Trazabilidad sanitaria (APPCC) — recepción de lotes y consumo por evento.
-- Antes vivían solo en migraciones (drift). `supplier_order_id` ahora tiene
-- FK real a supplier_orders (definida arriba, sección 20b.1); en una versión
-- anterior de este fichero se dejaba sin FK porque supplier_orders no existía.
-- ============================================================
CREATE TABLE IF NOT EXISTS receiving_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_order_id UUID REFERENCES supplier_orders(id) ON DELETE SET NULL,
    ingredient_id     UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    lot_number        TEXT NOT NULL,
    batch_quantity    NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit              TEXT NOT NULL DEFAULT 'g',
    received_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by       TEXT,
    expiry_date       DATE,
    temperature       NUMERIC(5,2),
    supplier          TEXT,
    condition_ok      BOOLEAN DEFAULT true,
    source            TEXT DEFAULT 'manual' CHECK (source IN ('manual','scan','api')),
    qr_code           TEXT,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receiving_ingredient ON receiving_log(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_receiving_lot ON receiving_log(lot_number);
CREATE INDEX IF NOT EXISTS idx_receiving_supplier ON receiving_log(supplier);
CREATE INDEX IF NOT EXISTS idx_receiving_date ON receiving_log(received_date);
CREATE INDEX IF NOT EXISTS idx_receiving_order ON receiving_log(supplier_order_id);
ALTER TABLE receiving_log DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lot_consumption (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receiving_log_id  UUID NOT NULL REFERENCES receiving_log(id) ON DELETE CASCADE,
    event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    quantity_consumed NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit              TEXT NOT NULL DEFAULT 'g',
    consumed_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lot_consumption_event ON lot_consumption(event_id);
CREATE INDEX IF NOT EXISTS idx_lot_consumption_receiving ON lot_consumption(receiving_log_id);
ALTER TABLE lot_consumption DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- APPCC — Análisis de Peligros y Puntos Críticos de Control
-- (antes solo en scripts/2026-06-22-appcc-migrate.sql, drift de esquema)
-- ============================================================
CREATE TABLE IF NOT EXISTS haccp_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  plan_type   TEXT NOT NULL CHECK (plan_type IN ('general','catering','specific')),
  version     INT NOT NULL DEFAULT 1,
  approved_by TEXT,
  approval_date DATE,
  valid_until DATE,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','expired','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_haccp_plans_event ON haccp_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_haccp_plans_status ON haccp_plans(status);

CREATE TABLE IF NOT EXISTS haccp_critical_limits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES haccp_plans(id) ON DELETE CASCADE,
  parameter         TEXT NOT NULL CHECK (parameter IN (
                      'temp_fridge','temp_freezer','temp_cold_room',
                      'temp_cook','temp_reheat','temp_hold',
                      'ph','aw','time_room_temp','time_shelf_life','storage')),
  name              TEXT NOT NULL,
  description       TEXT,
  min_value         NUMERIC(6,2),
  max_value         NUMERIC(6,2),
  unit              TEXT NOT NULL DEFAULT '°C',
  corrective_action TEXT,
  frequency         TEXT CHECK (frequency IN ('cada_30min','por_lote','cada_hora','diario','semanal')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_haccp_limits_plan ON haccp_critical_limits(plan_id);

CREATE TABLE IF NOT EXISTS haccp_monitoring (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_id    UUID NOT NULL REFERENCES haccp_critical_limits(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by TEXT NOT NULL,
  value       NUMERIC(6,2) NOT NULL,
  unit        TEXT NOT NULL DEFAULT '°C',
  status      TEXT NOT NULL CHECK (status IN ('ok','warning','critical')),
  notes       TEXT,
  is_corrected BOOLEAN DEFAULT false,
  corrected_at TIMESTAMPTZ,
  corrected_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_haccp_monitoring_limit ON haccp_monitoring(limit_id);
CREATE INDEX IF NOT EXISTS idx_haccp_monitoring_date ON haccp_monitoring(recorded_at DESC);

CREATE TABLE IF NOT EXISTS fridge_temperature_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
  fridge_name  TEXT NOT NULL,
  fridge_type  TEXT NOT NULL DEFAULT 'fridge' CHECK (fridge_type IN ('fridge','freezer','cold_room')),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  temperature  NUMERIC(5,2) NOT NULL,
  target_min   NUMERIC(5,2),
  target_max   NUMERIC(5,2),
  status       TEXT CHECK (status IN ('ok','warning','critical')),
  recorded_by  TEXT NOT NULL,
  notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_fridge_temp_date ON fridge_temperature_log(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_fridge_temp_name ON fridge_temperature_log(fridge_name);
CREATE INDEX IF NOT EXISTS idx_fridge_temp_event ON fridge_temperature_log(event_id);

CREATE TABLE IF NOT EXISTS cleaning_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  area          TEXT NOT NULL,
  schedule      TEXT NOT NULL CHECK (schedule IN ('diario','semanal','mensual','pre-evento','post-evento')),
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by  TEXT NOT NULL,
  verified_by   TEXT,
  verified_at   TIMESTAMPTZ,
  products_used TEXT[],
  notes         TEXT,
  checklist     JSONB DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_cleaning_area ON cleaning_log(area);
CREATE INDEX IF NOT EXISTS idx_cleaning_date ON cleaning_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cleaning_event ON cleaning_log(event_id);

CREATE TABLE IF NOT EXISTS supplier_approval (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  approved_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at      DATE,
  approved_by     TEXT NOT NULL,
  criteria_met    TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','suspended','revoked')),
  document_url    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_approval_provider ON supplier_approval(provider_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_supplier_approval_status ON supplier_approval(status);

CREATE TABLE IF NOT EXISTS traceability_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ingredient_id   UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  recipe_id       UUID REFERENCES recipes(id) ON DELETE SET NULL,
  lot_number      TEXT NOT NULL,
  receiving_id    UUID REFERENCES receiving_log(id) ON DELETE SET NULL,
  quantity_used   NUMERIC(10,3) NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'g',
  used_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by         TEXT,
  guest_served    INT,
  is_critical     BOOLEAN DEFAULT false,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_traceability_event ON traceability_log(event_id);
CREATE INDEX IF NOT EXISTS idx_traceability_ingredient ON traceability_log(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_traceability_lot ON traceability_log(lot_number);
CREATE INDEX IF NOT EXISTS idx_traceability_date ON traceability_log(used_at DESC);

CREATE TABLE IF NOT EXISTS haccp_equipment_calibration (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    UUID REFERENCES equipment(id) ON DELETE CASCADE,
  calibration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calibrated_by   TEXT NOT NULL,
  result          TEXT NOT NULL CHECK (result IN ('pass','fail','adjusted')),
  next_calibration DATE,
  certificate_url TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_haccp_calibration_equip ON haccp_equipment_calibration(equipment_id DESC);

CREATE OR REPLACE FUNCTION update_haccp_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_haccp_plans_updated ON haccp_plans;
CREATE TRIGGER trg_haccp_plans_updated BEFORE UPDATE ON haccp_plans
  FOR EACH ROW EXECUTE FUNCTION update_haccp_timestamp();

DROP TRIGGER IF EXISTS trg_supplier_approval_updated ON supplier_approval;
CREATE TRIGGER trg_supplier_approval_updated BEFORE UPDATE ON supplier_approval
  FOR EACH ROW EXECUTE FUNCTION update_haccp_timestamp();

-- ============================================================
-- SPRINT 1 · G1 — Reserva de salón con exclusión a nivel BD
-- (SPEC-Sprint1-CoreBusiness.md). Tres ubicaciones: Salón de Arriba,
-- Salón de Abajo (recursos exclusivos) y "fuera de los salones" (externo,
-- sin recurso → venue_id NULL → sin reserva). Granularidad: día completo.
-- ============================================================

-- btree_gist habilita el operador de igualdad (=) sobre uuid dentro de un
-- índice GiST, necesario para combinar `venue_id WITH =` y `daterange WITH &&`.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Catálogo de espacios reservables. Solo los salones físicos viven aquí;
-- "fuera de los salones" NO tiene fila (el evento externo lleva venue_id NULL).
CREATE TABLE IF NOT EXISTS venues (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,          -- 'salon-arriba' | 'salon-abajo'
    name        TEXT NOT NULL,
    capacity    INT,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO venues (slug, name, capacity) VALUES
    ('salon-arriba', 'Salón de Arriba', 180),
    ('salon-abajo',  'Salón de Abajo',  120)
ON CONFLICT (slug) DO NOTHING;

-- Vínculo evento → salón concreto. NULL = evento externo (sin recurso exclusivo).
-- Se conserva venue_type (benitez/externo) para el módulo Cocina; venue_id lo refina.
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- Reservas: 1 fila por evento con salón asignado. La exclusión impide que dos
-- reservas del MISMO salón solapen el MISMO día. El rango [fecha, fecha+1) deja
-- la puerta abierta a granularidad horaria futura sin cambiar el constraint.
CREATE TABLE IF NOT EXISTS venue_bookings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    event_id    UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    event_date  DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT venue_bookings_no_overlap
        EXCLUDE USING gist (
            venue_id WITH =,
            daterange(event_date, event_date + 1) WITH &&
        )
);

CREATE INDEX IF NOT EXISTS idx_venue_bookings_event ON venue_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_venue_date ON venue_bookings(venue_id, event_date);

-- ============================================================
-- SPRINT 2 · G2 — Compromiso de inventario al aceptar presupuesto
-- (SPEC-Sprint2-Inventory.md). Tras G1 (salón) y G3 (personal), G2 cierra la
-- tercera brecha de la bisagra acceptQuote: que dos eventos no se prometan
-- el mismo stock sin avisar.
-- ============================================================

-- Función de conversión de unidades — referenciada por
-- /api/stock/generate-order pero NUNCA se cargaba en schema.sql (bug real,
-- confirmado empíricamente: la ruta fallaba con "function convert_uom does
-- not exist" contra cualquier BD limpia). Solo vivía en
-- scripts/migration-escandallos-v2.sql, que no se ejecuta nunca.
CREATE OR REPLACE FUNCTION convert_uom(amount NUMERIC, from_unit VARCHAR, to_unit VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
  from_factor NUMERIC;
  to_factor NUMERIC;
BEGIN
  SELECT factor_to_base INTO from_factor FROM units_of_measure WHERE name = from_unit;
  SELECT factor_to_base INTO to_factor FROM units_of_measure WHERE name = to_unit;
  IF from_factor IS NULL OR to_factor IS NULL THEN RETURN amount; END IF;
  RETURN ROUND((amount * from_factor / to_factor)::numeric, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Una fila por (evento, ingrediente): cuánto de ese ingrediente "promete"
-- consumir este evento, en la unidad de stock del ingrediente. Se
-- crea/actualiza al aceptar presupuesto y se borra al revertir/cancelar/
-- cerrar (una vez el stock real refleja el consumo, el compromiso ya no
-- tiene sentido).
CREATE TABLE IF NOT EXISTS inventory_commitments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    qty_committed NUMERIC(12,3) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_commitments_ingredient ON inventory_commitments(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_commitments_event ON inventory_commitments(event_id);

-- E1 (decisión usuario): bloqueo opcional. Por defecto false (no bloqueante,
-- el comportamiento descrito en el spec); el negocio puede activarlo para
-- que aceptar un presupuesto con faltante de stock falle con 409 en vez de
-- solo avisar. Sin UI propia todavía (se añadirá en el rediseño del admin);
-- se gestiona vía PUT /api/settings.
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS block_accept_on_stock_shortage BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- SPRINT 2 · G6 — Unificación del doble ledger de stock (a petición
-- explícita del usuario, adelantado desde "Sprint 3"). `ingredients.quantity`
-- pasa a ser la ÚNICA fuente de verdad (la que ya usan escandallo,
-- stockDeduct y los nuevos inventory_commitments); `inventory`/
-- `inventory_movements` (consumidos por las pantallas de Trazabilidad) se
-- convierten en un ESPEJO de solo lectura, mantenido por trigger + por la
-- nueva función de dominio domain/stockLedger.ts (única vía de escritura).
--
-- Bug real confirmado leyendo el código: /api/trazabilidad/receiving/
-- from-order/[orderId] y /api/trazabilidad/lot-consumption/[eventId]
-- escribían SOLO en `inventory.quantity`, nunca en `ingredients.quantity`
-- — exactamente la divergencia silenciosa que describía la auditoría.
-- ============================================================

-- Backfill: toda fila de ingredients debe tener su espejo en inventory
-- (idempotente — solo inserta lo que falte).
INSERT INTO inventory (ingredient_id, quantity, unit, min_stock)
SELECT id, quantity, unit, min_stock FROM ingredients i
WHERE NOT EXISTS (SELECT 1 FROM inventory inv WHERE inv.ingredient_id = i.id);

-- Trigger de seguridad (defensa en profundidad): cualquier INSERT/UPDATE de
-- ingredients.quantity/min_stock — pase o no por domain/stockLedger.ts —
-- mantiene inventory.quantity/min_stock sincronizados DESDE EL MOMENTO EN
-- QUE EL INGREDIENTE EXISTE (no solo tras su primer cambio de cantidad —
-- cubre también ingredientes creados por seeds/migraciones posteriores a
-- schema.sql, que el backfill de arriba no puede alcanzar). min_stock tenía
-- la MISMA duplicación que quantity (vivía en ambas tablas sin sincronizar;
-- auto-orders lee ingredients.min_stock, la pantalla de Trazabilidad lee
-- inventory.min_stock). domain/stockLedger.ts hace además el registro
-- detallado en inventory_movements/stock_entries; este trigger solo
-- garantiza que los SALDOS nunca divergen.
CREATE OR REPLACE FUNCTION sync_inventory_quantity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (ingredient_id, quantity, unit, min_stock, last_movement_at)
  VALUES (NEW.id, NEW.quantity, NEW.unit, NEW.min_stock, now())
  ON CONFLICT (ingredient_id)
  DO UPDATE SET quantity = NEW.quantity, unit = NEW.unit, min_stock = NEW.min_stock, last_movement_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger de INSERT (sin WHEN — OLD no existe en este evento): garantiza
-- el espejo desde el primer instante del ingrediente.
DROP TRIGGER IF EXISTS trg_sync_inventory_insert ON ingredients;
CREATE TRIGGER trg_sync_inventory_insert
  AFTER INSERT ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION sync_inventory_quantity();

-- Trigger de UPDATE (con WHEN — evita escrituras innecesarias si cambia
-- otra columna que no sea quantity/min_stock).
DROP TRIGGER IF EXISTS trg_sync_inventory_quantity ON ingredients;
CREATE TRIGGER trg_sync_inventory_quantity
  AFTER UPDATE OF quantity, min_stock ON ingredients
  FOR EACH ROW
  WHEN (NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.min_stock IS DISTINCT FROM OLD.min_stock)
  EXECUTE FUNCTION sync_inventory_quantity();
