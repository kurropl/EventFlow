'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface MenuCardProps {
  name: string;
  tag: string;
  isKid?: boolean;
  sections: { section: string; items: string[] }[];
  isSelected: boolean;
  onSelect: () => void;
}

export default function MenuCard({ name, tag, isKid, sections, isSelected, onSelect }: MenuCardProps) {
  const tagColors: Record<string, string> = {
    'Esencial': 'bg-burgundy/10 text-burgundy border-burgundy/20',
    'Recomendado': 'bg-gold/10 text-gold-dark border-gold/20',
    'Rápido': 'bg-green-600/10 text-green-700 border-green-600/20',
    'Exclusivo': 'bg-purple-600/10 text-purple-700 border-purple-600/20',
    'Niños': 'bg-blue-600/10 text-blue-700 border-blue-600/20',
    'Especial': 'bg-orange-600/10 text-orange-700 border-orange-600/20',
    'Niños 1': 'bg-blue-600/10 text-blue-700 border-blue-600/20',
    'Niños 2': 'bg-blue-600/10 text-blue-700 border-blue-600/20',
  };

  return (
    <motion.button
      type="button"
      className={`group relative flex flex-col rounded-2xl border-2 p-6 text-left transition-all duration-300 ${
        isSelected
          ? 'border-gold bg-gold/5 shadow-lg shadow-gold/10'
          : 'border-cream-dark bg-paper hover:border-gold/30 hover:shadow-md'
      }`}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
    >
      {/* Selection indicator */}
      <div
        className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-200 ${
          isSelected
            ? 'border-gold bg-gold text-paper'
            : 'border-cream-dark bg-paper text-transparent'
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <h3 className="font-heading text-xl font-bold text-ink">{name}</h3>
        <Badge
          variant="outline"
          className={`border ${tagColors[tag] || 'border-cream-dark'}`}
        >
          {tag}
        </Badge>
      </div>

      <div className="mt-2 space-y-2">
        {sections.map((s) => (
          <div key={s.section}>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">
              {s.section}
            </span>
            <p className="text-sm text-ink/60">
              {s.items.join(' · ')}
            </p>
          </div>
        ))}
      </div>
    </motion.button>
  );
}
