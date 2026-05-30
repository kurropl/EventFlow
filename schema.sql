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
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(event_date);

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
