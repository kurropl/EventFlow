'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Icon from '@/components/shared/Icon';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'recetas', label: 'Recetas', icon: 'bookOpen' },
  { id: 'escandallos', label: 'Escandallos', icon: 'calculator' },
  { id: 'produccion', label: 'Producción', icon: 'cookingPot' },
  { id: 'carga', label: 'Carga', icon: 'truck' },
  { id: 'logistica', label: 'Logística', icon: 'package' },
  { id: 'stock', label: 'Stock', icon: 'warehouse' },
  { id: 'appcc', label: 'APPCC', icon: 'shield' },
];

export default function CocinaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === '/admin/cocina' || pathname === '/admin/cocina/';

  return (
    <div className="space-y-3">
      {/* Navegación tipo pills — siempre visible, sin cabecera duplicada */}
      <nav className="flex flex-wrap gap-1">
        <Link href="/admin/cocina"
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
            isRoot
              ? 'bg-ink text-white shadow-sm'
              : 'bg-white text-ink-soft hover:bg-cream hover:text-ink border border-divider/50'
          )}
        >
          <Icon name="chefHat" className={cn('w-3.5 h-3.5', isRoot ? 'text-gold' : 'text-ink-soft/70')} />
          <span>Panel</span>
        </Link>
        {NAV_ITEMS.map(item => {
          const isActive = pathname.includes(item.id) && !isRoot;
          return (
            <Link
              key={item.id}
              href={`/admin/cocina/${item.id}`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                isActive
                  ? 'bg-ink text-white shadow-sm'
                  : 'bg-white text-ink-soft hover:bg-cream hover:text-ink border border-divider/50'
              )}
            >
              <Icon name={item.icon} className={cn('w-3.5 h-3.5', isActive ? 'text-gold' : 'text-ink-soft/70')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}