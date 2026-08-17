export function validarAjuste(ajuste: number, tipo: string): boolean {
  if (!Number.isFinite(ajuste) || ajuste === 0) return false;
  return ['recuento','rotura','merma','caducado','sobrante','ajuste'].includes(tipo);
}