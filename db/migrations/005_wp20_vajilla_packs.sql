-- ============================================================
-- WP-20: Vajilla y Packs Automáticos
-- Migración 005_wp20_vajilla_packs.sql
-- ============================================================
-- Idempotente: usa IF NOT EXISTS
-- ============================================================

-- 1. TABLA DE PLANTILLAS DE VAJILLA
-- Cada plantilla define los ítems de vajilla por pase de servicio
CREATE TABLE IF NOT EXISTS vajilla_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    description     TEXT,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ÍTEMS DE LA PLANTILLA DE VAJILLA
-- Cada ítem se necesita por cada comensal en cada pase
CREATE TABLE IF NOT EXISTS vajilla_template_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id     UUID NOT NULL REFERENCES vajilla_templates(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,           -- 'Tenedor', 'Cuchillo', 'Plato hondo', etc.
    category        TEXT NOT NULL DEFAULT 'cubiertos', -- 'cubiertos', 'vajilla', 'cristaleria', 'textil'
    quantity_per_pax INT NOT NULL DEFAULT 1, -- Cuántas unidades por comensal
    pass_number     INT,                     -- NULL = aplica a todos los pases
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vajilla_items_template ON vajilla_template_items(template_id);

-- 3. TABLA DE PLANTILLAS DE PACKS
-- Packs predefinidos: Camareros, Alérgenos, Supervivencia
CREATE TABLE IF NOT EXISTS pack_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,           -- 'Pack Camareros', 'Pack Alérgenos', 'Pack Supervivencia'
    pack_type       TEXT NOT NULL CHECK (pack_type IN ('camareros', 'alergenos', 'supervivencia')),
    description     TEXT,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pack_type)
);

-- 4. ÍTEMS DE LA PLANTILLA DE PACKS
CREATE TABLE IF NOT EXISTS pack_template_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id     UUID NOT NULL REFERENCES pack_templates(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,           -- 'Guantes desechables', 'Delantal', etc.
    category        TEXT NOT NULL DEFAULT 'general', -- Para filtrar
    quantity_per_unit INT NOT NULL DEFAULT 1, -- Cantidad por invitado/empleado que aplique
    condition_type  TEXT DEFAULT 'all',      -- 'all' = siempre, 'dietary' = solo si cumple condición
    condition_value TEXT,                    -- Tipo de dieta: 'celiaco', 'sin_gluten', 'vegano', etc.
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pack_items_template ON pack_template_items(template_id);

-- 5. SEED: Plantilla de Vajilla por defecto
DO $$
DECLARE
    v_template_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vajilla_templates WHERE active = true LIMIT 1) THEN
        -- Crear plantilla de vajilla estándar
        INSERT INTO vajilla_templates (name, description)
        VALUES ('Vajilla Estándar', 'Plato completo por comensal y pase de servicio')
        RETURNING id INTO v_template_id;

        -- Cubiertos (por pase)
        INSERT INTO vajilla_template_items (template_id, name, category, quantity_per_pax, pass_number) VALUES
            (v_template_id, 'Tenedor', 'cubiertos', 1, NULL),
            (v_template_id, 'Cuchillo', 'cubiertos', 1, NULL),
            (v_template_id, 'Cuchara', 'cubiertos', 1, NULL),
            (v_template_id, 'Cucharilla café', 'cubiertos', 1, NULL);

        -- Vajilla (por pase)
        INSERT INTO vajilla_template_items (template_id, name, category, quantity_per_pax, pass_number) VALUES
            (v_template_id, 'Plato llano', 'vajilla', 1, NULL),
            (v_template_id, 'Plato hondo', 'vajilla', 1, NULL),
            (v_template_id, 'Plato postre', 'vajilla', 1, 4),
            (v_template_id, 'Plato pan', 'vajilla', 1, NULL),
            (v_template_id, 'Cuenco mantequilla', 'vajilla', 1, 1);

        -- Cristalería
        INSERT INTO vajilla_template_items (template_id, name, category, quantity_per_pax, pass_number) VALUES
            (v_template_id, 'Copa vino tinto', 'cristaleria', 1, NULL),
            (v_template_id, 'Copa vino blanco', 'cristaleria', 1, NULL),
            (v_template_id, 'Copa agua', 'cristaleria', 1, NULL),
            (v_template_id, 'Copa cava/champán', 'cristaleria', 1, NULL);

        -- Textil
        INSERT INTO vajilla_template_items (template_id, name, category, quantity_per_pax, pass_number) VALUES
            (v_template_id, 'Servilleta tela', 'textil', 1, NULL),
            (v_template_id, 'Mantequilla tela', 'textil', 1, NULL);

        RAISE NOTICE 'WP-20: Plantilla de vajilla estándar creada';
    ELSE
        RAISE NOTICE 'WP-20: Ya existe plantilla de vajilla activa, omitiendo seed';
    END IF;
END $$;

-- 6. SEED: Plantillas de Packs por defecto
DO $$
DECLARE
    v_camareros_id UUID;
    v_alergenos_id UUID;
    v_supervivencia_id UUID;
BEGIN
    -- Pack Camareros
    IF NOT EXISTS (SELECT 1 FROM pack_templates WHERE pack_type = 'camareros') THEN
        INSERT INTO pack_templates (name, pack_type, description)
        VALUES ('Pack Camareros', 'camareros', 'Equipamiento básico para el personal de sala')
        RETURNING id INTO v_camareros_id;

        INSERT INTO pack_template_items (template_id, name, category, quantity_per_unit, condition_type) VALUES
            (v_camareros_id, 'Delantal negro', 'uniforme', 1, 'all'),
            (v_camareros_id, 'Camisa blanca', 'uniforme', 1, 'all'),
            (v_camareros_id, 'Guantes blancos', 'proteccion', 2, 'all'),
            (v_camareros_id, 'Cucharones servir', 'utensilio', 1, 'all'),
            (v_camareros_id, 'Bandejones acero', 'utensilio', 2, 'all'),
            (v_camareros_id, 'Sartén antiadherente', 'utensilio', 1, 'all');

        RAISE NOTICE 'WP-20: Pack Camareros creado';
    END IF;

    -- Pack Alérgenos
    IF NOT EXISTS (SELECT 1 FROM pack_templates WHERE pack_type = 'alergenos') THEN
        INSERT INTO pack_templates (name, pack_type, description)
        VALUES ('Pack Alérgenos', 'alergenos', 'Ítems especiales para invitados con restricciones alimentarias')
        RETURNING id INTO v_alergenos_id;

        -- Ítems generales para alérgenos (siempre incluidos)
        INSERT INTO pack_template_items (template_id, name, category, quantity_per_unit, condition_type, notes) VALUES
            (v_alergenos_id, 'Servilleta identificativa', 'identificacion', 1, 'all', 'Marca visual para platos especiales'),
            (v_alergenos_id, 'Tarjeta alérgenos', 'identificacion', 1, 'all', 'Info del plato y alérgenos'),
            (v_alergenos_id, 'Cubiertos especiales', 'cubiertos', 1, 'all', 'Cubiertos destinados a platos sin alérgenos');

        -- Ítems específicos por tipo de restricción
        INSERT INTO pack_template_items (template_id, name, category, quantity_per_unit, condition_type, condition_value, notes) VALUES
            (v_alergenos_id, 'Pan sin gluten', 'alimento', 1, 'dietary', 'celiaco', 'Para celiacos'),
            (v_alergenos_id, 'Pan sin gluten', 'alimento', 1, 'dietary', 'sin_gluten', 'Para intolerantes al gluten'),
            (v_alergenos_id, 'Mantequilla sin lactosa', 'alimento', 1, 'dietary', 'intolerancia_lactosa', 'Para intolerantes a la lactosa'),
            (v_alergenos_id, 'Leche de avena', 'alimento', 1, 'dietary', 'vegano', 'Sustituto de leche de vaca'),
            (v_alergenos_id, 'Salsa alternativa', 'alimento', 1, 'dietary', 'vegano', 'Salsa sin productos animales'),
            (v_alergenos_id, 'Bandeja identificativa', 'identificacion', 1, 'dietary', 'celiaco', 'Marca visual en bandeja'),
            (v_alergenos_id, 'Bandeja identificativa', 'identificacion', 1, 'dietary', 'sin_gluten', 'Marca visual en bandeja'),
            (v_alergenos_id, 'Bandeja identificativa', 'identificacion', 1, 'dietary', 'intolerancia_lactosa', 'Marca visual en bandeja'),
            (v_alergenos_id, 'Bandeja identificativa', 'identificacion', 1, 'dietary', 'vegano', 'Marca visual en bandeja'),
            (v_alergenos_id, 'Bandeja identificativa', 'identificacion', 1, 'dietary', 'vegetariano', 'Marca visual en bandeja'),
            (v_alergenos_id, 'Plato sin frutos secos', 'alimento', 1, 'dietary', 'frutos_secos', 'Para alérgicos a frutos secos'),
            (v_alergenos_id, 'Plato sin mariscos', 'alimento', 1, 'dietary', 'mariscos', 'Para alérgicos a mariscos'),
            (v_alergenos_id, 'Plato sin huevo', 'alimento', 1, 'dietary', 'huevo', 'Para alérgicos al huevo');

        RAISE NOTICE 'WP-20: Pack Alérgenos creado';
    END IF;

    -- Pack Supervivencia
    IF NOT EXISTS (SELECT 1 FROM pack_templates WHERE pack_type = 'supervivencia') THEN
        INSERT INTO pack_templates (name, pack_type, description)
        VALUES ('Pack Supervivencia', 'supervivencia', 'Kit de emergencia para el evento')
        RETURNING id INTO v_supervivencia_id;

        INSERT INTO pack_template_items (template_id, name, category, quantity_per_unit, condition_type, notes) VALUES
            (v_supervivencia_id, 'Botiquín primeros auxilios', 'emergencia', 1, 'all', 'Kit completo de primeros auxilios'),
            (v_supervivencia_id, 'Manta térmica', 'emergencia', 2, 'all', 'Para hipotermia o quemaduras'),
            (v_supervivencia_id, 'Gafas de sol', 'comodidad', 1, 'all', 'Para eventos exteriores'),
            (v_supervivencia_id, 'Sombrilla plegable', 'comodidad', 1, 'all', 'Cobertura solar'),
            (v_supervivencia_id, 'Cargador portátil', 'tecnologia', 1, 'all', 'Power bank 10000mAh'),
            (v_supervivencia_id, 'Linterna LED', 'emergencia', 1, 'all', 'Para cortes de luz'),
            (v_supervivencia_id, 'Radio comunicador', 'comunicacion', 1, 'all', 'Comunicación del equipo');

        RAISE NOTICE 'WP-20: Pack Supervivencia creado';
    END IF;
END $$;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count FROM vajilla_templates;
    RAISE NOTICE 'WP-20 Verificación: Plantillas de vajilla = %', v_count;

    SELECT count(*) INTO v_count FROM vajilla_template_items;
    RAISE NOTICE 'WP-20 Verificación: Ítems de vajilla = %', v_count;

    SELECT count(*) INTO v_count FROM pack_templates;
    RAISE NOTICE 'WP-20 Verificación: Plantillas de packs = %', v_count;

    SELECT count(*) INTO v_count FROM pack_template_items;
    RAISE NOTICE 'WP-20 Verificación: Ítems de packs = %', v_count;
END $$;

-- Consulta de verificación final
SELECT 
    (SELECT count(*) FROM vajilla_templates WHERE active = true) as plantillas_vajilla,
    (SELECT count(*) FROM vajilla_template_items) as items_vajilla,
    (SELECT count(*) FROM pack_templates WHERE active = true) as plantillas_packs,
    (SELECT count(*) FROM pack_template_items) as items_packs;
