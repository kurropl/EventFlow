'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  pvp: number;
  cost: number;
  image_url: string | null;
  active: boolean;
}

const CATEGORIES = [
  'aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa',
  'carne', 'pescado', 'arroz', 'sorbete', 'postre', 'bebida', 'complemento',
];

const CATEGORY_LABELS: Record<string, string> = {
  'aperitivo-frio': 'Aperitivos fríos',
  'aperitivo-caliente': 'Aperitivos calientes',
  'compartir-mesa': 'A compartir en mesa',
  'carne': 'Carnes',
  'pescado': 'Pescados',
  'arroz': 'Arroces',
  'sorbete': 'Sorbetes',
  'postre': 'Postres',
  'bebida': 'Bebidas',
  'complemento': 'Complementos / Estaciones',
};

const CATEGORY_ITEMS: Record<string, string[]> = {
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

// Precios base por categoría (PVP y coste)
const PRICING: Record<string, { pvp: number; cost: number }> = {
  'aperitivo-frio': { pvp: 3.50, cost: 1.20 },
  'aperitivo-caliente': { pvp: 4.50, cost: 1.80 },
  'compartir-mesa': { pvp: 8.00, cost: 3.00 },
  'carne': { pvp: 12.00, cost: 4.50 },
  'pescado': { pvp: 11.00, cost: 4.00 },
  'arroz': { pvp: 10.00, cost: 3.80 },
  'sorbete': { pvp: 3.00, cost: 0.80 },
  'postre': { pvp: 4.00, cost: 1.20 },
  'bebida': { pvp: 2.50, cost: 0.90 },
  'complemento': { pvp: 15.00, cost: 6.00 },
};

// Variaciones de precio para items premium (+30%, -20%, etc.)
const PREMIUM_KEYWORDS = ['foie', 'trufa', 'vieja', 'carabinero', 'anguila', 'erizo', 'caviar', 'ostra', 'vieira', 'solomillo', 'mariscada'];

function buildCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [];
  let id = 1;
  for (const [cat, names] of Object.entries(CATEGORY_ITEMS)) {
    for (const name of names) {
      const base = PRICING[cat] || { pvp: 5, cost: 2 };
      // Premium markup
      const isPremium = PREMIUM_KEYWORDS.some(k => name.toLowerCase().includes(k));
      const multiplier = isPremium ? 1.4 : 1.0;
      const variance = 0.85 + Math.random() * 0.3; // ±15% aleatorio
      const pvp = Math.round(base.pvp * multiplier * variance * 100) / 100;
      const cost = Math.round(base.cost * multiplier * variance * 0.8 * 100) / 100; // coste ~80% del pvp base
      items.push({
        id: String(id++),
        name,
        category: cat,
        pvp: Math.max(1.5, pvp),
        cost: Math.max(0.5, cost),
        image_url: null,
        active: true,
      });
    }
  }
  return items;
}

const ALL_ITEMS = buildCatalog();

export default function CatalogCRUD() {
  const [items] = useState<CatalogItem[]>(ALL_ITEMS);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: CATEGORIES[0], pvp: '', cost: '' });

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [items, filterCategory, search]);

  const getCategoryMargin = (pvp: number, cost: number) => {
    if (pvp === 0) return 0;
    return Math.round(((pvp - cost) / pvp) * 100);
  };

  const handleAddItem = () => {
    if (!newItem.name.trim()) return;
    const pvp = parseFloat(newItem.pvp) || 0;
    const cost = parseFloat(newItem.cost) || 0;
    const newEntry: CatalogItem = {
      id: String(items.length + 1),
      name: newItem.name.trim(),
      category: newItem.category,
      pvp,
      cost,
      image_url: null,
      active: true,
    };
    items.push(newEntry);
    setShowForm(false);
    setNewItem({ name: '', category: CATEGORIES[0], pvp: '', cost: '' });
  };

  const totalItems = items.length;
  const activeItems = items.filter(i => i.active).length;
  const avgMargin = items.reduce((s, i) => s + getCategoryMargin(i.pvp, i.cost), 0) / items.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-cream text-xl font-serif mb-1">Catalogo de Articulos</h2>
          <p className="text-cream/40 text-sm">
            <span className="text-gold font-medium">{totalItems}</span> articulos · <span className="text-green-400/60">{avgMargin.toFixed(0)}%</span> margen medio · <span className="text-cream/50">{activeItems}</span> activos
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gold text-ink px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors"
        >
          + Nuevo Articulo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar articulo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2.5 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none"
        >
          <option value="all">Todas las categorias</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
      </div>

      {/* New Item Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-ink-900/40 rounded-xl border border-gold/20 p-4 space-y-3"
        >
          <h3 className="text-cream font-medium text-sm">Nuevo Articulo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text" placeholder="Nombre del plato" value={newItem.name}
              onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none"
            />
            <select value={newItem.category} onChange={e => setNewItem(n => ({ ...n, category: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none">
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <input type="number" placeholder="PVP (€)" step="0.01" value={newItem.pvp}
              onChange={e => setNewItem(n => ({ ...n, pvp: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none" />
            <input type="number" placeholder="Coste (€)" step="0.01" value={newItem.cost}
              onChange={e => setNewItem(n => ({ ...n, cost: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddItem} className="bg-gold text-ink px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-400">
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} className="text-cream/40 text-sm hover:text-cream/70">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {CATEGORIES.map(cat => {
          const count = items.filter(i => i.category === cat && i.active).length;
          return (
            <div key={cat} className={`px-3 py-2 rounded-lg border cursor-pointer transition-all ${filterCategory === cat ? 'border-gold bg-gold/5' : 'border-gold/10 bg-ink-900/40 hover:border-gold/30'}`}
              onClick={() => setFilterCategory(f => f === cat ? 'all' : cat)}>
              <div className="text-cream/40">{CATEGORY_LABELS[cat]}</div>
              <div className="text-cream font-medium">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-ink-900/40 rounded-xl border border-gold/10 overflow-hidden">
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-900/95 z-10">
              <tr className="border-b border-gold/10">
                <th className="text-left px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Articulo</th>
                <th className="text-left px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Categoria</th>
                <th className="text-right px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">PVP</th>
                <th className="text-right px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Coste</th>
                <th className="text-right px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Margen</th>
                <th className="text-center px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, i) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.005 }}
                  className="border-b border-gold/5 hover:bg-cream/3 transition-colors"
                >
                  <td className="px-4 py-2.5 text-cream text-xs max-w-[250px] truncate" title={item.name}>{item.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] bg-cream/5 text-cream/50 px-2 py-0.5 rounded-full">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-cream text-xs">{item.pvp.toFixed(2)}€</td>
                  <td className="px-4 py-2.5 text-right text-cream/50 text-xs">{item.cost.toFixed(2)}€</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full
                      ${getCategoryMargin(item.pvp, item.cost) >= 50 ? 'bg-green-500/10 text-green-400' :
                        getCategoryMargin(item.pvp, item.cost) >= 30 ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'}`}>
                      {getCategoryMargin(item.pvp, item.cost)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {item.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-cream/30">No se encontraron articulos</div>
        )}
        {filteredItems.length > 0 && (
          <div className="px-4 py-2 border-t border-gold/5 text-xs text-cream/30 text-right">
            Mostrando {filteredItems.length} de {items.length} articulos
          </div>
        )}
      </div>
    </div>
  );
}