-- Boda templates
INSERT INTO checklist_templates (event_type, sort_order, title, description, hours_before) VALUES
('boda', 1, 'Confirmar numero final de invitados con el cliente', 'Llamar al cliente para cerrar lista definitiva', 72),
('boda', 2, 'Revisar pedido de ingredientes con proveedores', 'Verificar que todos los pedidos estan confirmados', 48),
('boda', 3, 'Confirmar asistencia del personal contratado', 'Revisar confirmaciones de camareros, cocineros y metre', 48),
('boda', 4, 'Montaje de sillas y mesas segun mapa', 'Seguir el floor plan aprobado', 24),
('boda', 5, 'Colocacion de manteleria y centros de mesa', 'Verificar stock de manteleria y decoracion', 24),
('boda', 6, 'Preparacion de zona de cocina y cold room', 'Temperaturas OK, ingredientes preparados', 24),
('boda', 7, 'Briefing con todo el personal', 'Reparto de funciones y protocolo del servicio', 4),
('boda', 8, 'Prueba de sonido y coordinacion con DJ/musico', 'Verificar equipo audio y playlist', 4),
('boda', 9, 'Colocacion de menus en mesas', 'Verificar nombre y numero de mesa por invitado', 2),
('boda', 10, 'Revision final de sala con el metre', 'Ultimo check antes de apertura', 1),
('boda', 11, 'Apertura de barra', NULL, NULL),
('boda', 12, 'Cierre de caja y recuento', NULL, NULL),
('boda', 13, 'Enviar email de agradecimiento al cliente', NULL, NULL);

-- Corporativo templates
INSERT INTO checklist_templates (event_type, sort_order, title, description, hours_before) VALUES
('corporativo', 1, 'Confirmar asistentes finales con la empresa', 'Numero definitivo de asistentes', 72),
('corporativo', 2, 'Verificar pedidos de catering y bebidas', 'Confirmar con proveedores', 48),
('corporativo', 3, 'Confirmar personal de servicio', 'Camareros y cocineros contratados', 48),
('corporativo', 4, 'Montaje de mesas y sillas segun layout', 'Seguir plan de disposicion', 24),
('corporativo', 5, 'Preparacion de zona AV y proyector', 'Test de conexion, pantalla, microfonos', 24),
('corporativo', 6, 'Preparacion de zona de cafe y break', 'Cafetera, bocadillos, fruta', 24),
('corporativo', 7, 'Briefing con personal de servicio', 'Protocolo y horarios del evento', 4),
('corporativo', 8, 'Prueba de audio/video final', 'Conexion con portatiles del ponente', 2),
('corporativo', 9, 'Apertura de sala', NULL, NULL),
('corporativo', 10, 'Cierre y recuento', NULL, NULL);

-- Bautizo templates
INSERT INTO checklist_templates (event_type, sort_order, title, description, hours_before) VALUES
('bautizo', 1, 'Confirmar lista de invitados', 'Numero final de asistentes', 72),
('bautizo', 2, 'Confirmar catering y decoracion', 'Verificar con proveedores', 48),
('bautizo', 3, 'Montaje de sala', 'Mesas, sillas, decoracion infantil si aplica', 24),
('bautizo', 4, 'Preparacion de zona infantil', 'Manteleria especial, sillas infantiles', 24),
('bautizo', 5, 'Briefing con personal', NULL, 4),
('bautizo', 6, 'Apertura de sala', NULL, NULL),
('bautizo', 7, 'Cierre y agradecimiento', NULL, NULL);
