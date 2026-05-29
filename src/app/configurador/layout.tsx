/**
 * J.Benitez — Configurador Layout
 *
 * El chrome (cabecera + indicador de pasos) se renderiza dentro de
 * `page.tsx`, por lo que este layout solo actúa como contenedor para
 * evitar cabeceras duplicadas.
 */
export default function ConfiguradorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
