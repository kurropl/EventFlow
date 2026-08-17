export function agruparPorProveedor(faltantes: any[]): Record<string, any[]> {
  const res: Record<string, any[]> = {};
  for (const f of faltantes) {
    const s = f.supplier || 'Sin proveedor';
    if (!res[s]) res[s] = [];
    res[s].push(f);
  }
  return res;
}
export function validarAjuste(ajuste: number, tipo: string): boolean {
  if (!Number.isFinite(ajuste) || ajuste === 0) return false;
  return ['recuento','rotura','merma','caducado','sobrante','ajuste'].includes(tipo);
}