SELECT name, pvp, cost, category FROM catalog_items 
WHERE active = true AND ingredients IS NOT NULL AND ingredients != '[]'::jsonb
AND (
  name ILIKE '%jamón%ibérico%' OR
  name ILIKE '%croqueta%jamón%' OR
  name ILIKE '%carrillera%baja%' OR
  name ILIKE '%merluza%rellena%' OR
  name ILIKE '%sorbete%limón%' OR
  name ILIKE '%tarta%celebración%' OR
  name ILIKE '%cava%brindis%' OR
  name ILIKE '%vino%tinto%lomas%' OR
  name ILIKE '%chacinas%' OR
  name ILIKE '%solomillo%vac%' OR
  name ILIKE '%bacalao%confitado%' OR
  name ILIKE '%tarta%queso%' OR
  name ILIKE '%mucho%chocolate%' OR
  name ILIKE '%cerveza%' OR
  name ILIKE '%arroz%meloso%mariscos%' OR
  name ILIKE '%presa%brasa%'
)
ORDER BY name;
