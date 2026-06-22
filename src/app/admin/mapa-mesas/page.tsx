'use client';
import PremiumTableMapEditor from '@/components/b2b/PremiumTableMapEditor';
import AdminLayout from '@/components/b2b/AdminLayout';

export default function MapaMesasAdminPage() {
  return (
    <AdminLayout>
      <div className="h-[calc(100vh-60px)]">
        <PremiumTableMapEditor readOnly={false} />
      </div>
    </AdminLayout>
  );
}