'use client';
/**
 * EventFlow — Dish Card (B2C)
 * 
 * Muestra SOLO el nombre del plato. Sin precios.
 * Con hover effects y selección visual.
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
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 border-2 transition-all duration-300
        ${selected
          ? 'border-gold bg-gold/5 shadow-md shadow-gold/10'
          : 'border-gold/10 bg-paper hover:border-gold/40 hover:shadow-md hover:shadow-gold/5'
        }`}
      data-category={category}
      data-selected={selected}
    >
      <div className="flex items-start gap-3">
        {/* Selection indicator */}
        <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-all
          ${selected ? 'border-gold bg-gold' : 'border-gold/30'}`}>
          {selected && (
            <svg className="w-3.5 h-3.5 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        
        {/* Dish name */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed ${selected ? 'text-ink font-medium' : 'text-ink/80'}`}>
            {name}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
