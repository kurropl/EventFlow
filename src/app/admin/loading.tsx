export default function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F8]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#9CA3AF]">Cargando panel...</p>
      </div>
    </div>
  );
}