-- ============================================================
-- EVENTFLOW — RESET COMPLETO + DATOS REALISTAS DE DEMO
-- Ejecutar: docker exec -i eventflow-postgres psql -U postgres -d eventflow < /tmp/reset-demo.sql
-- ============================================================

-- ═══ 1. LIMPIAR TODOS LOS DATOS ═══
DELETE FROM guest_forms;
DELETE FROM event_shopping_items;
DELETE FROM payments;
DELETE FROM invoices;
DELETE FROM event_orders;
DELETE FROM quotes;
DELETE FROM waiters;
DELETE FROM events;
DELETE FROM leads;
DELETE FROM clients;
DELETE FROM automation_logs;
DELETE FROM webhook_logs;

-- ═══ 2. ACTUALIZAR CATÁLOGO CON PRECIOS REALES ═══
-- Aperitivos fríos (precio por ud/uap)
UPDATE catalog_items SET pvp = 3.20, cost = 1.40 WHERE name = 'Anchoa 00 y mantequilla trufada';
UPDATE catalog_items SET pvp = 2.80, cost = 1.10 WHERE name = 'Brioche de steak tartar de salchichón';
UPDATE catalog_items SET pvp = 2.60, cost = 1.00 WHERE name = 'Brioche de tomate, ventresca de atún y eneldo';
UPDATE catalog_items SET pvp = 3.80, cost = 1.60 WHERE name = 'Carpaccio de vaca vieja madurada, tomate y trufa';
UPDATE catalog_items SET pvp = 3.50, cost = 1.50 WHERE name = 'Cereza de foie';
UPDATE catalog_items SET pvp = 4.20, cost = 2.00 WHERE name = 'Chacinas y quesos';
UPDATE catalog_items SET pvp = 3.00, cost = 1.20 WHERE name = 'Conito de atún rojo, soja blanca y guacamole';
UPDATE catalog_items SET pvp = 2.80, cost = 1.10 WHERE name = 'Crujiente de salmón y aguacate';
UPDATE catalog_items SET pvp = 2.40, cost = 0.90 WHERE name = 'Ensaladilla cremosa, huevo frito y gamba cristal';
UPDATE catalog_items SET pvp = 3.60, cost = 1.50 WHERE name = 'Foie, maíz y trufa';
UPDATE catalog_items SET pvp = 2.20, cost = 0.80 WHERE name = 'Gazpacho de remolacha y queso feta';
UPDATE catalog_items SET pvp = 2.80, cost = 1.20 WHERE name = 'Gilda de atún rojo y encurtidos';
UPDATE catalog_items SET pvp = 2.80, cost = 1.20 WHERE name = 'Gilda de salmón ahumado y encurtidos';
UPDATE catalog_items SET pvp = 4.50, cost = 2.20 WHERE name = 'Milhojas de anguila ahumada';
UPDATE catalog_items SET pvp = 2.00, cost = 0.70 WHERE name = 'Mini ensalada César';
UPDATE catalog_items SET pvp = 1.80, cost = 0.60 WHERE name = 'Mini ensalada caprese';
UPDATE catalog_items SET pvp = 3.20, cost = 1.40 WHERE name = 'Mini ensalada de gambones en tempura y salsa yogurt';
UPDATE catalog_items SET pvp = 4.00, cost = 1.80 WHERE name = 'Navaja de buzo, emulsión de hierbas y lima';
UPDATE catalog_items SET pvp = 5.50, cost = 2.80 WHERE name = 'Ostras al natural / toppings';
UPDATE catalog_items SET pvp = 1.60, cost = 0.50 WHERE name = 'Papas aliñás de Sanlúcar';
UPDATE catalog_items SET pvp = 3.80, cost = 1.60 WHERE name = 'Salpicón de vieira y ají amarillo';
UPDATE catalog_items SET pvp = 3.00, cost = 1.20 WHERE name = 'Steak tartar sobre croissant crujiente';
UPDATE catalog_items SET pvp = 3.40, cost = 1.40 WHERE name = 'Tartaleta de manzana ácida y erizo';
UPDATE catalog_items SET pvp = 3.60, cost = 1.50 WHERE name = 'Tartar de atún rojo picante y huevo frito';
UPDATE catalog_items SET pvp = 3.40, cost = 1.40 WHERE name = 'Tartar de calamar, carbonara de coliflor y caviar ahumado';
UPDATE catalog_items SET pvp = 2.20, cost = 0.80 WHERE name = 'Tosta de queso payoyo, tomate seco y chicharrones';

-- Aperitivos calientes (precio por ud/uap)
UPDATE catalog_items SET pvp = 3.00, cost = 1.20 WHERE name = 'Alcachofas fritas, queso trufado y jamón ibérico';
UPDATE catalog_items SET pvp = 2.80, cost = 1.00 WHERE name = 'Alcachofas y gambas al ajillo';
UPDATE catalog_items SET pvp = 2.20, cost = 0.80 WHERE name = 'Alita de pollo deshuesada y teriyaki de ajos';
UPDATE catalog_items SET pvp = 2.60, cost = 1.00 WHERE name = 'Atún encebollado a nuestra manera';
UPDATE catalog_items SET pvp = 3.40, cost = 1.40 WHERE name = 'Bao bun de costilla con salsa BBQ-miso';
UPDATE catalog_items SET pvp = 3.20, cost = 1.30 WHERE name = 'Bao bun de langostino en tempura y kimchi';
UPDATE catalog_items SET pvp = 3.00, cost = 1.20 WHERE name = 'Bocadillo de cola de toro, yema de huevo y queso comté';
UPDATE catalog_items SET pvp = 2.80, cost = 1.10 WHERE name = 'Brocheta de langostino y mango';
UPDATE catalog_items SET pvp = 3.20, cost = 1.30 WHERE name = 'Brocheta de solomillo y anticucho';
UPDATE catalog_items SET pvp = 2.40, cost = 0.90 WHERE name = 'Calamares a la riojana, hechos en casa';
UPDATE catalog_items SET pvp = 2.60, cost = 1.00 WHERE name = 'Choco frito de nuestras costas';
UPDATE catalog_items SET pvp = 2.20, cost = 0.70 WHERE name = 'Croquetas de jamón ibérico';
UPDATE catalog_items SET pvp = 2.60, cost = 0.90 WHERE name = 'Croquetas de queso de cabra, trufa y presa';
UPDATE catalog_items SET pvp = 3.00, cost = 1.20 WHERE name = 'Empanadillas de boletus, carrillera y trufa';
UPDATE catalog_items SET pvp = 2.40, cost = 0.90 WHERE name = 'Empanadillas de ventresca de atún con tomate';
UPDATE catalog_items SET pvp = 2.80, cost = 1.10 WHERE name = 'Gyozas de pringá, crema de remolacha y hierbabuena';
UPDATE catalog_items SET pvp = 3.50, cost = 1.50 WHERE name = 'Lubina / gallineta, frita entera en adobo';
UPDATE catalog_items SET pvp = 3.80, cost = 1.60 WHERE name = 'Marmitaco de cangrejo azul y rape';
UPDATE catalog_items SET pvp = 2.00, cost = 0.70 WHERE name = 'Mini hot dog de chistorra criolla y mayo-japo';
UPDATE catalog_items SET pvp = 2.20, cost = 0.80 WHERE name = 'Mini pita de pringá y ali oli de hierbabuena';
UPDATE catalog_items SET pvp = 3.60, cost = 1.50 WHERE name = 'Mini vieira rellena de mariscos y salsa coreana';

-- Arroces (precio por persona)
UPDATE catalog_items SET pvp = 8.50, cost = 3.20 WHERE name = 'Arroz meloso de carrillera, setas y foie';
UPDATE catalog_items SET pvp = 9.00, cost = 3.80 WHERE name = 'Arroz meloso de mariscos y pescados de roca';

-- Carnes (precio por persona)
UPDATE catalog_items SET pvp = 12.50, cost = 5.00 WHERE name = 'Carrillera a baja temperatura con puré de patatas trufado';
UPDATE catalog_items SET pvp = 14.00, cost = 6.00 WHERE name = 'Ciervo a baja temperatura, cremoso de boniato y su salsa reducida';
UPDATE catalog_items SET pvp = 11.50, cost = 4.50 WHERE name = 'Confit de pato, risotto de calabaza y salsa Pekín';
UPDATE catalog_items SET pvp = 13.00, cost = 5.50 WHERE name = 'Cordero a baja temperatura, patatas fritas al ajillo y su jugo';
UPDATE catalog_items SET pvp = 10.50, cost = 4.00 WHERE name = 'Lasaña de carrillera gratinada con queso pecorino';
UPDATE catalog_items SET pvp = 13.50, cost = 5.80 WHERE name = 'Presa a la brasa, salsa al whisky, patatas fritas, padrón y piquillos';
UPDATE catalog_items SET pvp = 14.50, cost = 6.20 WHERE name = 'Solomillo de vaca vieja, cremoso de patata y salsa a la pimienta negra';

-- Pescados (precio por persona)
UPDATE catalog_items SET pvp = 11.00, cost = 4.50 WHERE name = 'Lomo de bacalao confitado, espinacas ahumadas a la crema';
UPDATE catalog_items SET pvp = 10.50, cost = 4.20 WHERE name = 'Lubina, cremoso de coliflor y jugo del cocido';
UPDATE catalog_items SET pvp = 10.00, cost = 4.00 WHERE name = 'Merluza gratinada con crema de ajo asado y salsa roteña';
UPDATE catalog_items SET pvp = 11.50, cost = 4.80 WHERE name = 'Merluza rellena de mariscos y almejas a la marinera';
UPDATE catalog_items SET pvp = 12.00, cost = 5.00 WHERE name = 'Rodaballo y verduritas de temporada a la bilbaína';
UPDATE catalog_items SET pvp = 12.50, cost = 5.20 WHERE name = 'Ventresca de atún rojo al horno con fritada de tomates';

-- Compartir mesa (precio por persona)
UPDATE catalog_items SET pvp = 5.50, cost = 2.20 WHERE name = 'Berenjena a la brasa, glaseada con teriyaki y celery';
UPDATE catalog_items SET pvp = 6.50, cost = 2.80 WHERE name = 'Canelón de boletus con cola de toro y salsa de foie al PX';
UPDATE catalog_items SET pvp = 6.00, cost = 2.50 WHERE name = 'Canelón de calabacín y aguacate relleno de cangrejo al kimchi';
UPDATE catalog_items SET pvp = 7.00, cost = 3.00 WHERE name = 'Canelón de carabinero relleno de marisco, mango y aguacate';
UPDATE catalog_items SET pvp = 7.50, cost = 3.20 WHERE name = 'Carpaccio de vaca vieja madurada con trufa y colmenillas';
UPDATE catalog_items SET pvp = 5.00, cost = 2.00 WHERE name = 'Chacina variada (jamón, queso y lomito de presa)';
UPDATE catalog_items SET pvp = 6.00, cost = 2.50 WHERE name = 'Espárrago blanco 00 relleno de langostinos al ajillo';
UPDATE catalog_items SET pvp = 5.50, cost = 2.20 WHERE name = 'Huevos rotos estilo Alboroto (papada ibérica y gambones)';
UPDATE catalog_items SET pvp = 8.00, cost = 3.50 WHERE name = 'Lingote de foie, queso de cabra y compota de pera asada';
UPDATE catalog_items SET pvp = 9.50, cost = 4.50 WHERE name = 'Mariscada (langostinos, gambas, cigala)';
UPDATE catalog_items SET pvp = 6.50, cost = 2.80 WHERE name = 'Pulpo a la brasa, parmentier de patata y mojo picón';
UPDATE catalog_items SET pvp = 4.50, cost = 1.80 WHERE name = 'Tartar de tomate y quisquilla, gazpacho de tomates amarillos';

-- Complementos (precio por ud/o servicio)
UPDATE catalog_items SET pvp = 180.00, cost = 80.00 WHERE name = 'Barbacoa en directo';
UPDATE catalog_items SET pvp = 120.00, cost = 45.00 WHERE name = 'Buffet de tartas';
UPDATE catalog_items SET pvp = 150.00, cost = 60.00 WHERE name = 'Cortador de jamón en directo';
UPDATE catalog_items SET pvp = 85.00, cost = 35.00 WHERE name = 'El rincón del vegano';
UPDATE catalog_items SET pvp = 65.00, cost = 25.00 WHERE name = 'Estación de agua con sabores';
UPDATE catalog_items SET pvp = 140.00, cost = 55.00 WHERE name = 'Estación de ahumados';
UPDATE catalog_items SET pvp = 160.00, cost = 65.00 WHERE name = 'Estación de arroces';
UPDATE catalog_items SET pvp = 95.00, cost = 38.00 WHERE name = 'Estación de buñuelos de la abuela';
UPDATE catalog_items SET pvp = 110.00, cost = 42.00 WHERE name = 'Estación de cervezas';
UPDATE catalog_items SET pvp = 130.00, cost = 50.00 WHERE name = 'Estación de chacina';
UPDATE catalog_items SET pvp = 200.00, cost = 85.00 WHERE name = 'Estación de cócteles';
UPDATE catalog_items SET pvp = 120.00, cost = 48.00 WHERE name = 'Estación de fritos en directo';
UPDATE catalog_items SET pvp = 175.00, cost = 75.00 WHERE name = 'Estación de mariscos';
UPDATE catalog_items SET pvp = 90.00, cost = 35.00 WHERE name = 'Estación de salmorejos';
UPDATE catalog_items SET pvp = 165.00, cost = 70.00 WHERE name = 'Estación de sushi';
UPDATE catalog_items SET pvp = 100.00, cost = 40.00 WHERE name = 'Estación de vermut y encurtidos';
UPDATE catalog_items SET pvp = 145.00, cost = 58.00 WHERE name = 'Estación mexicana';
UPDATE catalog_items SET pvp = 190.00, cost = 80.00 WHERE name = 'Estación raw bar';
UPDATE catalog_items SET pvp = 220.00, cost = 95.00 WHERE name = 'Food truck';
UPDATE catalog_items SET pvp = 180.00, cost = 75.00 WHERE name = 'Hora loca';
UPDATE catalog_items SET pvp = 75.00, cost = 28.00 WHERE name = 'Mesa de chuches';
UPDATE catalog_items SET pvp = 135.00, cost = 55.00 WHERE name = 'Planeta helado (estación de helados)';
UPDATE catalog_items SET pvp = 170.00, cost = 72.00 WHERE name = 'Show cooking de ostras';

-- Bebidas (precio por persona/copa)
UPDATE catalog_items SET pvp = 1.20, cost = 0.30 WHERE name = 'Agua';
UPDATE catalog_items SET pvp = 3.50, cost = 1.20 WHERE name = 'Cava brindis';
UPDATE catalog_items SET pvp = 2.50, cost = 0.80 WHERE name = 'Cerveza con y sin';
UPDATE catalog_items SET pvp = 2.00, cost = 0.60 WHERE name = 'Frizzante';
UPDATE catalog_items SET pvp = 3.00, cost = 1.00 WHERE name = 'Manzanilla';
UPDATE catalog_items SET pvp = 1.80, cost = 0.40 WHERE name = 'Refrescos';
UPDATE catalog_items SET pvp = 4.00, cost = 1.50 WHERE name = 'Vino blanco Verdejo';
UPDATE catalog_items SET pvp = 4.50, cost = 1.80 WHERE name = 'Vino tinto Lomas del Marquez';

-- Postres (precio por persona)
UPDATE catalog_items SET pvp = 3.50, cost = 1.20 WHERE name = 'Helado de yogurt con tocino y nueces caramelizadas';
UPDATE catalog_items SET pvp = 4.00, cost = 1.50 WHERE name = 'Lemon pie';
UPDATE catalog_items SET pvp = 4.50, cost = 1.80 WHERE name = 'Mucho chocolate';
UPDATE catalog_items SET pvp = 4.20, cost = 1.60 WHERE name = 'Pantera rosa';
UPDATE catalog_items SET pvp = 3.80, cost = 1.40 WHERE name = 'Surtido de minipasteles';
UPDATE catalog_items SET pvp = 5.00, cost = 2.00 WHERE name = 'Tarta de celebración';
UPDATE catalog_items SET pvp = 4.00, cost = 1.50 WHERE name = 'Tarta de queso';
UPDATE catalog_items SET pvp = 4.50, cost = 1.70 WHERE name = 'Torrija, helado de vainilla y toffee de coco';

-- Sorbetes (precio por persona)
UPDATE catalog_items SET pvp = 3.00, cost = 1.00 WHERE name = 'Sorbete de frutos rojos, helado de queso y coulis de fresa';
UPDATE catalog_items SET pvp = 2.80, cost = 0.90 WHERE name = 'Sorbete de lima, helado de menta y hierbabuena escarchada';
UPDATE catalog_items SET pvp = 2.50, cost = 0.80 WHERE name = 'Sorbete de limón';
UPDATE catalog_items SET pvp = 2.50, cost = 0.80 WHERE name = 'Sorbete de mandarina';
UPDATE catalog_items SET pvp = 3.20, cost = 1.10 WHERE name = 'Sorbete de piña asada, helado de coco y gelatina de ron';

-- Jamón ibérico (el que estaba a 0)
UPDATE catalog_items SET pvp = 5.50, cost = 2.80 WHERE name = 'Jamón ibérico 75% bellota';

-- Verificar
SELECT category, count(*)::int as items, 
  count(*) FILTER (WHERE pvp > 0)::int as con_precio
FROM catalog_items WHERE active = true GROUP BY category ORDER BY category;
