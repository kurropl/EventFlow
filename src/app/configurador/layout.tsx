const STEPS = ['Detalles', 'Menú', 'Personaliza', 'Extras', 'Resumen'];

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-50 bg-ink-900/95 backdrop-blur border-b border-gold/20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif text-gold text-lg">Alboroto Eventos</span>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
