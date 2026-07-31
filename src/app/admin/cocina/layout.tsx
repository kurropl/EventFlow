'use client';

import AdminLayout from '@/components/b2b/AdminLayout';

/**
 * Layout de Cocina — hereda el layout admin global (sidebar lateral).
 *
 * WP-FIX-01: este layout fue introducido en el merge f40b5eb (WP-28)
 * renderizando una navegación tipo pills paralela SIN <AdminLayout>, lo que
 * dejaba a /admin/cocina/* sin el menú lateral global del resto de módulos.
 * Se reduce a un simple wrapper de AdminLayout: la subnavegación de Cocina
 * (Panel, Recetas, Escandallos, Producción, Carga, Logística, APPCC, Compras)
 * vive en el sidebar, como children del item 'cocina' de AdminLayout.
 * Un solo sidebar: prohibida la navegación paralela solo para Cocina.
 */
export default function CocinaLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
