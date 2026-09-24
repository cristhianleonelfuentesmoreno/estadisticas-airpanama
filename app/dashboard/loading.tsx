// Esqueleto mientras carga una sección del dashboard. El header y la navegación
// siguen visibles (antes era un overlay a pantalla completa que tapaba todo).
export default function Loading() {
  return (
    <div className="flex flex-col gap-space-md pt-space-md animate-pulse" aria-busy="true" aria-label="Cargando" data-route-loading>
      <div className="h-32 rounded-xl bg-surface-container" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
        <div className="h-28 rounded-xl bg-surface-container" />
        <div className="h-28 rounded-xl bg-surface-container" />
      </div>
      <div className="h-64 rounded-xl bg-surface-container" />
    </div>
  );
}
