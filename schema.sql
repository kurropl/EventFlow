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
    quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
    client_name     TEXT NOT NULL,
    client_email    TEXT NOT NULL,
    client_phone    TEXT,
    event_type      TEXT NOT NULL CHECK (event_type IN ('boda','cumpleaños','corporativo','bautizo','comunión','otro')),
    guest_count     INT NOT NULL CHECK (guest_count > 0),
    kids_count      INT NOT NULL DEFAULT 0,
    event_date      DATE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo','propuesta_enviada','confirmado','cancelado','en_curso','completado')),
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

-- Add operations_generated_at to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS operations_generated_at TIMESTAMPTZ;
-- stock_deducted: idempotency flag for /api/stock/deduct (was referenced by the
-- deduct route but never defined → 500 on a clean DB).
ALTER TABLE events ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;
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
    status              TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
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
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 20. INGREDIENTS (Materias primas para escandallos)
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL UNIQUE,
    unit            TEXT NOT NULL DEFAULT 'gr' CHECK (unit IN ('gr','kg','ml','l','ud','docena','caja','bote')),
    cost_per_unit   NUMERIC(10,4) NOT NULL DEFAULT 0,
    supplier        TEXT,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ingredients DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_ingredients_updated ON ingredients;
CREATE TRIGGER trg_ingredients_updated BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
ALTER TABLE events ADD CONSTRAINT events_status_check
    CHECK (status IN ('draft','sent','accepted','in_progress','completed','paid','cancelled'));

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
-- 31b. INGREDIENTS (Entidad única de ingredientes)
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'general',
    unit TEXT NOT NULL DEFAULT 'g',
    unit_cost NUMERIC(8,4) NOT NULL DEFAULT 0,
    pvp_ratio NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    stock_unit TEXT NOT NULL DEFAULT 'g',
    packaging_size NUMERIC(10,2),
    supplier_id UUID REFERENCES suppliers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
ALTER TABLE ingredients DISABLE ROW LEVEL SECURITY;

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
  ADD COLUMN IF NOT EXISTS quantity_override NUMERIC(10,2);

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
  ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT false;
