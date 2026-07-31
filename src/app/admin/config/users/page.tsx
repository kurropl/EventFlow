'use client';

import { useState, useEffect } from 'react';
import UsersManager from '@/components/b2b/UsersManager';
import { PageHeader, Spinner } from '@/components/ui';

export default function ConfigUsersPage() {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-divider/50 p-4 sm:p-5">
        <h1 className="text-sm font-medium text-ink">Usuarios y Roles</h1>
        <p className="text-xs text-ink-soft mt-0.5">Gestiona los usuarios del sistema y sus permisos según el rol</p>
      </div>
      <UsersManager />
    </div>
  );
}