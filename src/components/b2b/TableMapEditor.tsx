'use client';
/**
 * J.Benitez — Editor de Mapa de Mesas
 * 
 * Editor interactivo drag & drop para la gestión de mesas del salon.
 * Permite añadir, mover y redimensionar mesas con visualización en tiempo real.
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Table {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'round' | 'rect' | 'long';
  seats: number;
  label: string;
  color: string;
}

const TABLE_COLORS = [
  '#C9A84C', '#8B7332', '#6B7B8B', '#7B8B7B', '#8B7B8B', '#8B8B7B',
  '#5B8B8B', '#8B5B8B', '#8B8B5B', '#5B5B8B', '#8B5B5B', '#5B8B5B'
];

export default function TableMapEditor() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const addTable = (type: Table['type']) => {
    const newTable: Table = {
      id: `table-${Date.now()}`,
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 200,
      width: type === 'long' ? 120 : type === 'round' ? 60 : 80,
      height: type === 'long' ? 40 : type === 'round' ? 60 : 60,
      type,
      seats: type === 'long' ? 8 : type === 'round' ? 8 : 10,
      label: `M${tables.length + 1}`,
      color: TABLE_COLORS[tables.length % TABLE_COLORS.length],
    };
    setTables([...tables, newTable]);
    setShowAddMenu(false);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    const table = tables.find(t => t.id === tableId);
    if (!table || containerRef.current) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragging(tableId);
    setSelectedTable(tableId);
    setDragOffset({
      x: e.clientX - rect.left - table.x,
      y: e.clientY - rect.top - table.y,
    });
  }, [tables]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    setTables(prev => prev.map(t => 
      t.id === dragging ? { ...t, x: Math.max(0, x), y: Math.max(0, y) } : t
    ));
  }, [dragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const deleteTable = (tableId: string) => {
    setTables(prev => prev.filter(t => t.id !== tableId));
    setSelectedTable(null);
  };

  const updateTable = (tableId: string, updates: Partial<Table>) => {
    setTables(prev => prev.map(t => 
      t.id === tableId ? { ...t, ...updates } : t
    ));
  };

  const selectedTableData = tables.find(t => t.id === selectedTable);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-stone-200">
        <div>
          <h2 className="font-serif text-2xl text-stone-800">Mapa de Mesas</h2>
          <p className="text-sm text-stone-500">Arrastra y suelta las mesas para organizar el salon</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="px-4 py-2 rounded-lg bg-[#C9A84C] text-white text-sm font-medium hover:bg-[#A88A3A] transition-colors"
          >
            + Añadir Mesa
          </button>
          <button className="px-4 py-2 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors">
            Guardar Mapa
          </button>
        </div>
      </div>

      {/* Add Menu */}
      <AnimatePresence>
        {showAddMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 border-b border-stone-200 bg-stone-50"
          >
            <div className="flex gap-3">
              <button
                onClick={() => addTable('round')}
                className="px-4 py-2 rounded-lg border border-stone-200 bg-white hover:border-[#C9A84C] transition-colors"
              >
                Mesa Redonda (8)
              </button>
              <button
                onClick={() => addTable('rect')}
                className="px-4 py-2 rounded-lg border border-stone-200 bg-white hover:border-[#C9A84C] transition-colors"
              >
                Mesa Cuadrada (10)
              </button>
              <button
                onClick={() => addTable('long')}
                className="px-4 py-2 rounded-lg border border-stone-200 bg-white hover:border-[#C9A84C] transition-colors"
              >
                Mesa Larga (12)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden" style={{ background: '#FAF8F5' }}>
          <div
            ref={containerRef}
            className="absolute inset-0"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Grid background */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }} />

            {/* Tables */}
            <AnimatePresence>
              {tables.map((table) => (
                <motion.div
                  key={table.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className={`absolute cursor-move ${dragging === table.id ? 'z-50' : 'z-10'}`}
                  style={{
                    left: table.x,
                    top: table.y,
                    width: table.width,
                    height: table.height,
                    borderRadius: table.type === 'round' ? '50%' : '8px',
                    background: table.color,
                    boxShadow: dragging === table.id ? '0 8px 25px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                  onMouseDown={(e) => handleMouseDown(e, table.id)}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">{table.label}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Properties Panel */}
        {selectedTableData && (
          <div className="w-80 border-l border-stone-200 bg-white p-6">
            <h3 className="font-serif text-lg text-stone-800 mb-4">Propiedades de Mesa</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Etiqueta</label>
                <input
                  type="text"
                  value={selectedTableData.label}
                  onChange={(e) => updateTable(selectedTableData.id, { label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Comensales</label>
                <input
                  type="number"
                  value={selectedTableData.seats}
                  onChange={(e) => updateTable(selectedTableData.id, { seats: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {TABLE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateTable(selectedTableData.id, { color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedTableData.color === color ? 'border-stone-800 scale-110' : 'border-stone-200'
                      }`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200">
                <button
                  onClick={() => deleteTable(selectedTableData.id)}
                  className="w-full px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Eliminar Mesa
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-stone-200 bg-stone-50">
        <div className="flex items-center justify-between text-sm text-stone-600">
          <span>{tables.length} mesas colocadas</span>
          <span>{tables.reduce((sum, t) => sum + t.seats, 0)} comensales totales</span>
        </div>
      </div>
    </div>
  );
}
