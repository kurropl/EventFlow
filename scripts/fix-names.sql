-- Fix selected_items to match EXACT catalog names for escandallo generation

-- Event 1: María García — ACEPTADO
UPDATE events SET selected_items = '[
  {"item_id":"i01","name":"Chacinas y quesos","category":"aperitivo-frio","quantity":6,"unit_price_pvp":4.20,"unit_price_cost":2.00,"subtotal_pvp":25.20,"subtotal_cost":12.00},
  {"item_id":"i02","name":"Croquetas de jamón ibérico","category":"aperitivo-caliente","quantity":10,"unit_price_pvp":2.20,"unit_price_cost":0.70,"subtotal_pvp":22.00,"subtotal_cost":7.00},
  {"item_id":"i03","name":"Carrillera a baja temperatura con puré de patatas trufado","category":"carne","quantity":80,"unit_price_pvp":12.50,"unit_price_cost":5.00,"subtotal_pvp":1000.00,"subtotal_cost":400.00},
  {"item_id":"i04","name":"Merluza rellena de mariscos y almejas a la marinera","category":"pescado","quantity":40,"unit_price_pvp":11.50,"unit_price_cost":4.80,"subtotal_pvp":460.00,"subtotal_cost":192.00},
  {"item_id":"i05","name":"Sorbete de limón","category":"sorbete","quantity":120,"unit_price_pvp":2.50,"unit_price_cost":0.80,"subtotal_pvp":300.00,"subtotal_cost":96.00},
  {"item_id":"i06","name":"Tarta de celebración","category":"postre","quantity":120,"unit_price_pvp":5.00,"unit_price_cost":2.00,"subtotal_pvp":600.00,"subtotal_cost":240.00},
  {"item_id":"i07","name":"Cava brindis","category":"bebida","quantity":120,"unit_price_pvp":3.50,"unit_price_cost":1.20,"subtotal_pvp":420.00,"subtotal_cost":144.00},
  {"item_id":"i08","name":"Vino tinto Lomas del Marquez","category":"bebida","quantity":120,"unit_price_pvp":4.50,"unit_price_cost":1.80,"subtotal_pvp":540.00,"subtotal_cost":216.00}
]'::jsonb
WHERE id = 'e0000001-0000-0000-0000-000000000001';

-- Event 2: Pedro Sánchez — ENVIADO
UPDATE events SET selected_items = '[
  {"item_id":"i09","name":"Chacinas y quesos","category":"aperitivo-frio","quantity":4,"unit_price_pvp":4.20,"unit_price_cost":2.00,"subtotal_pvp":16.80,"subtotal_cost":8.00},
  {"item_id":"i10","name":"Solomillo de vaca vieja, cremoso de patata y salsa a la pimienta negra","category":"carne","quantity":25,"unit_price_pvp":14.50,"unit_price_cost":6.20,"subtotal_pvp":362.50,"subtotal_cost":155.00},
  {"item_id":"i11","name":"Lomo de bacalao confitado, espinacas ahumadas a la crema","category":"pescado","quantity":15,"unit_price_pvp":11.00,"unit_price_cost":4.50,"subtotal_pvp":165.00,"subtotal_cost":67.50},
  {"item_id":"i12","name":"Tarta de queso","category":"postre","quantity":40,"unit_price_pvp":4.00,"unit_price_cost":1.50,"subtotal_pvp":160.00,"subtotal_cost":60.00}
]'::jsonb
WHERE id = 'e0000001-0000-0000-0000-000000000002';

-- Event 3: Eventos CR — COMPLETADO
UPDATE events SET selected_items = '[
  {"item_id":"i13","name":"Presa a la brasa, salsa al whisky, patatas fritas, padrón y piquillos","category":"carne","quantity":60,"unit_price_pvp":13.50,"unit_price_cost":5.80,"subtotal_pvp":810.00,"subtotal_cost":348.00},
  {"item_id":"i14","name":"Arroz meloso de mariscos y pescados de roca","category":"arroz","quantity":60,"unit_price_pvp":9.00,"unit_price_cost":3.80,"subtotal_pvp":540.00,"subtotal_cost":228.00},
  {"item_id":"i15","name":"Mucho chocolate","category":"postre","quantity":60,"unit_price_pvp":4.50,"unit_price_cost":1.80,"subtotal_pvp":270.00,"subtotal_cost":108.00},
  {"item_id":"i16","name":"Cerveza con y sin","category":"bebida","quantity":60,"unit_price_pvp":2.50,"unit_price_cost":0.80,"subtotal_pvp":150.00,"subtotal_cost":48.00}
]'::jsonb
WHERE id = 'e0000001-0000-0000-0000-000000000003';

-- Verify
SELECT client_name, jsonb_array_length(selected_items) as items FROM events WHERE status != 'draft';
