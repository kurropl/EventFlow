/**
 * EventFlow — Menús Propuestos (Alboroto Eventos 2025)
 * Fuente: https://byalboroto.duckdns.org/
 * 
 * Estos menús se muestran en el configurador B2C SIN precios.
 * Solo el admin B2B ve los precios.
 */

export interface ProposedMenu {
  id: string;
  name: string;
  tag: string;
  is_kid: boolean;
  sections: { section: string; items: string[] }[];
}

export const PROPOSED_MENUS: ProposedMenu[] = [
  {
    id: 'menu1', name: 'Menú 1', tag: 'Esencial', is_kid: false,
    sections: [
      { section: 'Aperitivos en mesa', items: ['Gorditas del sur','Pan individual','Jamón','Queso','Caña de lomo','Gambas cocidas','Frito variado (4 tipos)'] },
      { section: 'Plato principal', items: ['Sorbete de limón','Carrillera a baja temperatura con puré trufado'] },
      { section: 'Postre y bebida', items: ['Postre del día','Cava','Cerveza con/sin','Vino tinto','Verdejo y Frizzante','Manzanilla','Refrescos','Agua'] },
    ],
  },
  {
    id: 'menu2', name: 'Menú 2', tag: 'Recomendado', is_kid: false,
    sections: [
      { section: 'Aperitivos fríos', items: ['Gorditas del sur','Jamón ibérico 75% bellota','Selección Apolonio','Chupito andaluz de la huerta','Patatas aliñadas con ventresca','Tosta de queso payoyo','Cazuelita de revuelto ibérico'] },
      { section: 'Aperitivos calientes', items: ['Choco frito','Adobo sevillano','Croquetas de cocido','Mini pita de pringá'] },
      { section: 'Plato principal', items: ['Sorbete de limón','Carrillera a baja temperatura con puré trufado'] },
      { section: 'Postre y bebida', items: ['Postre','Cava','Cerveza con/sin','Vino tinto','Verdejo y Frizzante','Manzanilla','Refrescos','Agua'] },
    ],
  },
  {
    id: 'menu3', name: 'Menú 3', tag: 'Completo', is_kid: false,
    sections: [
      { section: 'Aperitivos fríos', items: ['Gorditas del sur','Jamón ibérico 75% bellota','Selección Apolonio','Chupito andaluz de la huerta','Patatas aliñadas con ventresca','Tosta de queso payoyo','Cazuelita de revuelto ibérico'] },
      { section: 'Aperitivos calientes', items: ['Choco frito','Adobo sevillano','Croquetas de cocido','Mini pita de pringá'] },
      { section: 'En mesa a compartir', items: ['Gambas cocidas'] },
      { section: 'Plato principal', items: ['Sorbete de limón','Carrillera a baja temperatura con puré trufado'] },
      { section: 'Postre y bebida', items: ['Postre','Cava','Cerveza con/sin','Vino tinto','Verdejo y Frizzante','Manzanilla','Refrescos','Agua'] },
    ],
  },
  {
    id: 'menu4', name: 'Menú 4', tag: 'Premium', is_kid: false,
    sections: [
      { section: 'Aperitivos fríos', items: ['Gorditas del sur','Jamón ibérico 75% bellota','Selección Apolonio','Chupito andaluz','Patatas aliñadas con ventresca','Tosta queso payoyo','Cremoso de ensaladilla con huevo de codorniz','Tosta presa ibérica, queso de cabra y mermelada de pimiento'] },
      { section: 'Aperitivos calientes', items: ['Choco frito','Adobo sevillano','Croquetas de cocido','Delicias de pollo con miel y mostaza','Mini pita de pringá'] },
      { section: 'Plato principal', items: ['Carrillera a baja temperatura con puré trufado'] },
      { section: 'Postre y bebida', items: ['Surtido de mini pastelitos','Cava','Cerveza con/sin','Vino tinto Lomas del Marquez','Verdejo y Frizzante','Manzanilla','Refrescos','Agua'] },
    ],
  },
  {
    id: 'menu5', name: 'Menú 5', tag: 'Premium +', is_kid: false,
    sections: [
      { section: 'Aperitivos fríos', items: ['Gorditas del sur','Jamón ibérico 75% bellota','Selección Apolonio','Chupito andaluz','Patatas aliñadas con ventresca','Tosta queso payoyo','Cremoso de ensaladilla','Tosta presa ibérica','Cazuelita de revuelto ibérico'] },
      { section: 'Aperitivos calientes', items: ['Choco frito','Adobo sevillano','Croquetas de cocido','Delicia de pollo con miel y mostaza','Mini pavías de bacalao','Mini pita de pringá'] },
      { section: 'Plato principal', items: ['Carrillera a baja temperatura con puré trufado'] },
      { section: 'Postre y bebida', items: ['Surtido de mini pastelitos','Cava','Cerveza con/sin','Vino tinto Lomas del Marquez','Verdejo y Frizzante','Manzanilla','Refrescos','Agua'] },
    ],
  },
  {
    id: 'menu6', name: 'Menú 6', tag: 'Gran Selección', is_kid: false,
    sections: [
      { section: 'Aperitivos fríos', items: ['Gorditas del sur','Jamón ibérico 75% bellota','Selección Apolonio','Lomo mechado con AOVE','Pincho clásico de tortilla','Chupito andaluz','Patatas aliñadas con ventresca','Tosta queso payoyo','Tosta presa ibérica con mermelada de pimiento'] },
      { section: 'Aperitivos calientes', items: ['Choco frito','Adobo sevillano','Croquetas de cocido','Delicia de pollo con miel y mostaza','Mini pavías de bacalao','Mini pita de pringá','Mini de solomillo al whisky'] },
      { section: 'Postre y bebida', items: ['Surtido de mini pastelitos','Cava','Cerveza con/sin','Vino tinto Lomas del Marquez','Verdejo y Frizzante','Manzanilla','Refrescos','Agua'] },
    ],
  },
  {
    id: 'kid1', name: 'Menú Niño 1', tag: 'Infantil', is_kid: true,
    sections: [
      { section: 'Para cada 4 comensales', items: ['Olivas sabor anchoas sin hueso','Patatas chips','Pan individual','Croquetas de puchero','Pinchos de tortilla'] },
      { section: 'Plato individual', items: ['Media pechuga de pollo empanada, mini hamburguesa, patatas fritas y kétchup'] },
      { section: 'Postre y bebida', items: ['Helado de vainilla','Refrescos','Agua','Zumos'] },
    ],
  },
  {
    id: 'kid2', name: 'Menú Niño 2', tag: 'Infantil +', is_kid: true,
    sections: [
      { section: 'A compartir cada 4', items: ['Olivas sin hueso','Patatas chips','Pan individual','Jamón 75% ibérico de bellota','Choco','Croquetas de puchero'] },
      { section: 'Plato individual', items: ['Media pechuga de pollo, mini hamburguesa, patatas fritas y kétchup'] },
      { section: 'Postre y bebida', items: ['Helado de vainilla o chocolate','Zumos','Refrescos','Agua'] },
    ],
  },
];

// Categorías del catálogo individual (118 items)
export const CATALOG_CATEGORIES = [
  { id: 'aperitivo-frio', label: 'Aperitivos fríos', minSelect: 4 },
  { id: 'aperitivo-caliente', label: 'Aperitivos calientes', minSelect: 4 },
  { id: 'compartir-mesa', label: 'A compartir en mesa', minSelect: 1 },
  { id: 'carne', label: 'Carnes', minSelect: 1 },
  { id: 'pescado', label: 'Pescados', minSelect: 1 },
  { id: 'arroz', label: 'Arroces', minSelect: 0 },
  { id: 'sorbete', label: 'Sorbetes', minSelect: 1 },
  { id: 'postre', label: 'Postres', minSelect: 1 },
  { id: 'bebida', label: 'Bebidas', minSelect: 0 },
  { id: 'complemento', label: 'Complementos / Estaciones', minSelect: 0 },
];

// Items del catálogo por categoría
export const CATALOG_ITEMS: Record<string, string[]> = {
  'aperitivo-frio': [
    'Ensaladilla cremosa, huevo frito y gamba cristal',
    'Papas aliñás de Sanlúcar',
    'Anchoa 00 y mantequilla trufada',
    'Chacinas y quesos',
    'Gazpacho de remolacha y queso feta',
    'Tosta de queso payoyo, tomate seco y chicharrones',
    'Brioche de steak tartar de salchichón',
    'Brioche de tomate, ventresca de atún y eneldo',
    'Steak tartar sobre croissant crujiente',
    'Carpaccio de vaca vieja madurada, tomate y trufa',
    'Tartaleta de manzana ácida y erizo',
    'Tartar de calamar, carbonara de coliflor y caviar ahumado',
    'Crujiente de salmón y aguacate',
    'Tartar de atún rojo picante y huevo frito',
    'Conito de atún rojo, soja blanca y guacamole',
    'Cereza de foie',
    'Foie, maíz y trufa',
    'Milhojas de anguila ahumada',
    'Mini ensalada César',
    'Mini ensalada de gambones en tempura y salsa yogurt',
    'Mini ensalada caprese',
    'Salpicón de vieira y ají amarillo',
    'Navaja de buzo, emulsión de hierbas y lima',
    'Gilda de atún rojo y encurtidos',
    'Gilda de salmón ahumado y encurtidos',
    'Ostras al natural / toppings',
  ],
  'aperitivo-caliente': [
    'Gyozas de pringá, crema de remolacha y hierbabuena',
    'Empanadillas de boletus, carrillera y trufa',
    'Empanadillas de ventresca de atún con tomate',
    'Croquetas de jamón ibérico',
    'Croquetas de queso de cabra, trufa y presa',
    'Mini hot dog de chistorra criolla y mayo-japo',
    'Mini pita de pringá y ali oli de hierbabuena',
    'Bocadillo de cola de toro, yema de huevo y queso comté',
    'Bao bun de costilla con salsa BBQ-miso',
    'Bao bun de langostino en tempura y kimchi',
    'Alita de pollo deshuesada y teriyaki de ajos',
    'Atún encebollado a nuestra manera',
    'Mini vieira rellena de mariscos y salsa coreana',
    'Lubina / gallineta, frita entera en adobo',
    'Choco frito de nuestras costas',
    'Alcachofas fritas, queso trufado y jamón ibérico',
    'Alcachofas y gambas al ajillo',
    'Calamares a la riojana, hechos en casa',
    'Marmitaco de cangrejo azul y rape',
    'Brocheta de langostino y mango',
    'Brocheta de solomillo y anticucho',
  ],
  'compartir-mesa': [
    'Canelón de carabinero relleno de marisco, mango y aguacate',
    'Lingote de foie, queso de cabra y compota de pera asada',
    'Carpaccio de vaca vieja madurada con trufa y colmenillas',
    'Tartar de tomate y quisquilla, gazpacho de tomates amarillos',
    'Canelón de calabacín y aguacate relleno de cangrejo al kimchi',
    'Chacina variada (jamón, queso y lomito de presa)',
    'Mariscada (langostinos, gambas, cigala)',
    'Berenjena a la brasa, glaseada con teriyaki y celery',
    'Espárrago blanco 00 relleno de langostinos al ajillo',
    'Canelón de boletus con cola de toro y salsa de foie al PX',
    'Huevos rotos estilo Alboroto (papada ibérica y gambones)',
    'Pulpo a la brasa, parmentier de patata y mojo picón',
  ],
  'carne': [
    'Carrillera a baja temperatura con puré de patatas trufado',
    'Cordero a baja temperatura, patatas fritas al ajillo y su jugo',
    'Lasaña de carrillera gratinada con queso pecorino',
    'Presa a la brasa, salsa al whisky, patatas fritas, padrón y piquillos',
    'Confit de pato, risotto de calabaza y salsa Pekín',
    'Solomillo de vaca vieja, cremoso de patata y salsa a la pimienta negra',
    'Ciervo a baja temperatura, cremoso de boniato y su salsa reducida',
  ],
  'pescado': [
    'Lubina, cremoso de coliflor y jugo del cocido',
    'Rodaballo y verduritas de temporada a la bilbaína',
    'Ventresca de atún rojo al horno con fritada de tomates',
    'Lomo de bacalao confitado, espinacas ahumadas a la crema',
    'Merluza gratinada con crema de ajo asado y salsa roteña',
    'Merluza rellena de mariscos y almejas a la marinera',
  ],
  'arroz': [
    'Arroz meloso de mariscos y pescados de roca',
    'Arroz meloso de carrillera, setas y foie',
  ],
  'sorbete': [
    'Sorbete de limón',
    'Sorbete de mandarina',
    'Sorbete de piña asada, helado de coco y gelatina de ron',
    'Sorbete de lima, helado de menta y hierbabuena escarchada',
    'Sorbete de frutos rojos, helado de queso y coulis de fresa',
  ],
  'postre': [
    'Tarta de celebración',
    'Lemon pie',
    'Torrija, helado de vainilla y toffee de coco',
    'Mucho chocolate',
    'Tarta de queso',
    'Pantera rosa',
    'Helado de yogurt con tocino y nueces caramelizadas',
    'Surtido de minipasteles',
  ],
  'bebida': [
    'Cerveza con y sin',
    'Vino tinto Lomas del Marquez',
    'Vino blanco Verdejo',
    'Frizzante',
    'Manzanilla',
    'Refrescos',
    'Agua',
    'Cava brindis',
  ],
  'complemento': [
    'Estación de agua con sabores',
    'Estación de vermut y encurtidos',
    'Estación de salmorejos',
    'Estación de ahumados',
    'El rincón del vegano',
    'Estación de cervezas',
    'Estación de chacina',
    'Estación raw bar',
    'Estación de mariscos',
    'Show cooking de ostras',
    'Estación mexicana',
    'Cortador de jamón en directo',
    'Estación de cócteles',
    'Estación de arroces',
    'Estación de fritos en directo',
    'Estación de sushi',
    'Food truck',
    'Barbacoa en directo',
    'Mesa de chuches',
    'Buffet de tartas',
    'Estación de buñuelos de la abuela',
    'Planeta helado (estación de helados)',
    'Hora loca',
  ],
};
