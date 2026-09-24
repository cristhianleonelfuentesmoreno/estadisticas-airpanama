// Qué puede hacer cada rol. Lo usan el servidor (para autorizar) y la interfaz (para
// mostrar u ocultar botones), así ambos siempre coinciden. Sin dependencias de servidor.

export type Role = 'administrador' | 'supervisor' | 'usuario'

export const ROLE_LABEL: Record<Role, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  usuario: 'Usuario',
}

export const toRole = (value: unknown): Role =>
  value === 'administrador' || value === 'supervisor' ? value : 'usuario'

const staff = (r: Role) => r === 'supervisor' || r === 'administrador'
const admin = (r: Role) => r === 'administrador'

export const can = {
  // Trabajo diario: cualquier usuario aprobado
  approveFlights: (_r: Role) => true,
  // Eliminar un vuelo directamente; los usuarios solo pueden solicitarlo
  deleteFlights: staff,
  reviewDeletionRequests: staff,
  restoreFlights: staff,
  // Panel de supervisión
  accessPanel: staff,
  viewAudit: staff,
  viewDevices: staff,
  // Aceptar o rechazar usuarios, editar su nombre y cargo, enviar enlace de contraseña
  manageUsers: staff,
  // Solo el administrador
  manageRoles: admin,
  deleteAccounts: admin,
  manageSettings: admin,
  manageFleet: admin,
}

// Un supervisor solo gestiona cuentas de usuarios; las de supervisores y administradores
// quedan en manos del administrador
export const canManageAccount = (actor: Role, target: Role) =>
  actor === 'administrador' || (actor === 'supervisor' && target === 'usuario')
