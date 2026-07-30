-- ============================================================
-- WP-20: Verificación de la migración de vajilla y packs
-- ============================================================

-- Verificar tablas creadas
SELECT 
    (SELECT count(*) FROM information_schema.tables 
     WHERE table_name = 'vajilla_templates') as vajilla_templates_existe,
    (SELECT count(*) FROM information_schema.tables 
     WHERE table_name = 'vajilla_template_items') as vajilla_items_existe,
    (SELECT count(*) FROM information_schema.tables 
     WHERE table_name = 'pack_templates') as pack_templates_existe,
    (SELECT count(*) FROM information_schema.tables 
     WHERE table_name = 'pack_template_items') as pack_items_existe;

-- Verificar datos semilla
SELECT 
    (SELECT count(*) FROM vajilla_templates WHERE active = true) as plantillas_vajilla,
    (SELECT count(*) FROM vajilla_template_items) as items_vajilla,
    (SELECT count(*) FROM pack_templates WHERE active = true) as plantillas_packs,
    (SELECT count(*) FROM pack_template_items) as items_packs;

-- Verificar estructura de vajilla
SELECT vt.name as plantilla, vti.name as item, vti.category, vti.quantity_per_pax, vti.pass_number
FROM vajilla_templates vt
JOIN vajilla_template_items vti ON vti.template_id = vt.id
WHERE vt.active = true
ORDER BY vti.category, vti.name;

-- Verificar estructura de packs
SELECT pt.name as pack, pt.pack_type, pti.name as item, pti.category, 
       pti.quantity_per_unit, pti.condition_type, pti.condition_value
FROM pack_templates pt
JOIN pack_template_items pti ON pti.template_id = pt.id
WHERE pt.active = true
ORDER BY pt.pack_type, pti.category, pti.name;
