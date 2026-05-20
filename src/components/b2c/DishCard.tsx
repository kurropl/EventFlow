'use client';
/**
 * EventFlow — Dish Card (B2C)
 * 
 * Tarjeta limpia para selección de platos.
 * Sin emojis. Texto oscuro sobre fondo blanco.
 */

import { motion } from 'framer-motion';

interface DishCardProps {
  name: string;
  selected: boolean;
  onClick: () => void;
  category?: string;
}

export default function DishCard({ name, selected, onClick, category }: DishCardProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 border-2 transition-all duration-200
        ${selected
          ? 'border-amber-600 bg-amber-50/50 shadow-sm'
          : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
        }`}
      data-category={category}
      data-selected={selected}
    >
      <div className="flex items-start gap-3">
        {/* Selection indicator */}
        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors
          ${selected ? 'border-amber-600 bg-amber-600' : 'border-stone-300'}`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        
        {/* Dish name */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed ${selected ? 'text-stone-800 font-medium' : 'text-stone-700'}`}>
            {name}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
