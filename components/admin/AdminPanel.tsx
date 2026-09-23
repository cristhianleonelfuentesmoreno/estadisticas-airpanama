"use client";

import { useState } from "react";
import { updateUserStatus, updateUserRole, updateUserCargo, deleteUserAction, updateUserName, sendPasswordResetAction } from "@/app/actions/admin";
import { toast } from "sonner";

import { SettingsWidget } from "./SettingsWidget";
import { ApiManagementWidget } from "./ApiManagementWidget";
import { DispositivosPanel } from "./DispositivosPanel";
import { AuditoriaPanel } from "./AuditoriaPanel";
import { FleetKnowledgePanel } from "./FleetKnowledgePanel";

export interface User {
  id: string;
  email: string;
  role: "administrador" | "usuario";
  status: "aprobado" | "pendiente" | "rechazado";
  nombre: string | null;
  cargo: string | null;
  created_at: string;
}

export function AdminPanel({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);

  // Estados temporales para el modal
  const [tempStatus, setTempStatus] = useState<User['status']>('pendiente');
  const [tempRole, setTempRole] = useState<User['role']>('usuario');
  const [tempCargo, setTempCargo] = useState<string>('');
  const [tempNombre, setTempNombre] = useState<string>('');

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setTempStatus(user.status);
    setTempRole(user.role);
    setTempCargo(user.cargo || '');
    setTempNombre(user.nombre || '');
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);

    try {
      const promises = [];
      if (tempStatus !== editingUser.status) promises.push(updateUserStatus(editingUser.id, tempStatus));
      if (tempRole !== editingUser.role) promises.push(updateUserRole(editingUser.id, tempRole));
      if (tempCargo !== (editingUser.cargo || '')) promises.push(updateUserCargo(editingUser.id, tempCargo));
      if (tempNombre !== (editingUser.nombre || '')) promises.push(updateUserName(editingUser.id, tempNombre));

      await Promise.all(promises);

      // Actualizar estado local
      setUsers(users.map(u => u.id === editingUser.id ? { 
        ...u, 
        status: tempStatus, 
        role: tempRole, 
        cargo: tempCargo,
        nombre: tempNombre
      } : u));

      // Mensaje estético
      toast.custom(() => (
        <div className="bg-surface-container-lowest border-l-4 border-emerald-500 p-4 rounded-xl shadow-lg flex items-start gap-4 animate-in slide-in-from-bottom-5">
          <div className="bg-emerald-100 text-emerald-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">check_circle</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface">¡Cambios Guardados!</h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">
              El usuario <strong>{editingUser.nombre || editingUser.email}</strong> ha sido actualizado correctamente.
            </p>
          </div>
        </div>
      ), { duration: 4000 });

      setEditingUser(null);
    } catch {
      toast.error("Ocurrió un error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingUser) return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${editingUser.email}? Esta acción no se puede deshacer.`)) return;

    setIsDeleting(true);
    try {
      const res = await deleteUserAction(editingUser.id);
      if (res.error) throw new Error(res.error);
      
      setUsers(users.filter(u => u.id !== editingUser.id));
      toast.success("Usuario eliminado exitosamente.");
      setEditingUser(null);
    } catch (error) {
      toast.error(`Error al eliminar usuario: ${(error as Error).message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendReset = async () => {
    if (!editingUser) return;
    if (!window.confirm(`¿Enviar a ${editingUser.email} un correo para restablecer su contraseña?`)) return;

    setIsSendingReset(true);
    try {
      const res = await sendPasswordResetAction(editingUser.id);
      if (res.error) throw new Error(res.error);
      toast.success(`Enlace enviado a ${res.email}. Es válido por tiempo limitado.`);
    } catch (error) {
      toast.error(`No se pudo enviar el enlace: ${(error as Error).message}`);
    } finally {
      setIsSendingReset(false);
    }
  };

  const activos = users.filter(u => u.status === 'aprobado').length;
  const pendientes = users.filter(u => u.status === 'pendiente').length;
  const administradores = users.filter(u => u.role === 'administrador').length;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* ========================================= */}
      {/* WIDGET DE CONFIGURACIÓN Y APIs            */}
      {/* ========================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingsWidget />
        <ApiManagementWidget />
      </div>

      {/* ========================================= */}
      {/* TARJETAS DE RESUMEN Y MONITOREO           */}
      {/* ========================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
        {/* Card 1: Gestión de Usuarios */}
        <div className="flex flex-col bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-tertiary-fixed flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-primary font-bold">Gestión de Usuarios</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{users.length} en plantilla total</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-primary font-bold">
              {activos} activos
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 my-space-md bg-surface-container-low p-2.5 rounded-lg">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Admins</span>
              <span className="font-headline-sm text-headline-sm font-bold text-primary">{administradores}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Pendientes</span>
              <span className="font-headline-sm text-headline-sm font-bold text-secondary-container">{pendientes}</span>
            </div>
          </div>
          <button className="w-full mt-auto flex items-center justify-center gap-1.5 py-2.5 px-space-sm rounded-lg bg-primary-container text-on-primary font-label-md text-label-md active:scale-95 transition-all opacity-50 cursor-not-allowed">
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            + Nuevo Usuario & Permisos
          </button>
        </div>

        {/* Card 2: Monitoreo Activo */}
        <div className="flex flex-col bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[20px]">dns</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-primary font-bold">Monitoreo Activo</span>
                <span className="font-label-sm text-label-sm text-emerald-700 font-semibold">Salud 99.8% • En Línea</span>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[14px] text-secondary-container">security</span>
              <span className="font-label-sm text-label-sm font-bold">Sin caídas 72h</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 my-space-md bg-surface-container-low p-2.5 rounded-lg">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Incidentes Críticos</span>
              <div className="flex items-center gap-1.5">
                <span className="font-headline-sm text-headline-sm font-bold text-primary">0</span>
                <span className="font-label-sm text-label-sm text-emerald-600 font-bold">Limpio</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Latencia Nodo PAC</span>
              <div className="flex items-center gap-1.5">
                <span className="font-headline-sm text-headline-sm font-bold text-primary">42ms</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Óptima</span>
              </div>
            </div>
            <div className="flex flex-col pt-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Base Datos Ops</span>
              <span className="font-label-md text-label-md font-semibold text-primary">Sync OK</span>
            </div>
            <div className="flex flex-col pt-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Cifrado Sesiones</span>
              <span className="font-label-md text-label-md font-semibold text-primary">AES-256</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-auto pt-1">
            <span className="font-body-sm text-body-sm text-on-surface-variant">Gateway Meteorológico PAC</span>
            <span className="font-label-sm text-label-sm text-secondary-container font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container"></span>
              1 aviso leve
            </span>
          </div>
        </div>
      </section>

      {/* ========================================= */}
      {/* SECCIÓN 1: USUARIOS CONECTADOS             */}
      {/* ========================================= */}
      <section className="flex flex-col gap-space-sm mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary-container">devices</span>
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
              Dispositivos & Ubicación Activa
            </h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm font-bold">
            {users.length} Registros
          </span>
        </div>

        <div className="flex flex-col gap-space-xs">
          {(showAllUsers ? users : users.slice(0, 5)).map(user => (
            <article key={user.id} className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface-container-lowest shadow-sm relative group cursor-pointer hover:bg-surface-container-lowest/80 transition-colors border border-transparent hover:border-outline-variant/30" onClick={() => openEditModal(user)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md font-bold ${
                    user.role === 'administrador' ? 'bg-primary-container text-on-primary' : 'bg-tertiary-container text-on-tertiary'
                  }`}>
                    {user.nombre ? user.nombre.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0 pr-8">
                    <span className="font-label-md text-label-md text-primary font-bold truncate">
                      {user.nombre || "Sin Nombre"}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant truncate flex items-center gap-1">
                      {user.email} <span className="opacity-50">•</span> <span className="capitalize">{user.role}</span>
                    </span>
                  </div>
                </div>
                {user.status === 'aprobado' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-label-sm text-label-sm font-semibold whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Activo
                  </span>
                ) : user.status === 'pendiente' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-label-sm text-label-sm font-semibold whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    Pendiente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm font-semibold whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Rechazado
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm">
                  <span className="material-symbols-outlined text-[16px] text-secondary-container">badge</span>
                  <span>{user.cargo || 'Sin asignar'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-body-sm text-body-sm text-outline">
                    {new Date(user.created_at).toLocaleDateString('es-PA')}
                  </span>
                </div>
              </div>
              
              {/* Edit Icon Overlay on Hover */}
              <button 
                className="absolute top-1/2 -translate-y-1/2 right-4 w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface opacity-0 md:group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </article>
          ))}
        </div>
        
        {users.length > 5 && (
          <div className="flex justify-center mt-2 mb-6">
            <button 
              onClick={() => setShowAllUsers(!showAllUsers)}
              className="px-6 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md font-bold rounded-full transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showAllUsers ? 'expand_less' : 'expand_more'}
              </span>
              {showAllUsers ? 'Ver menos' : `Mostrar todos (${users.length})`}
            </button>
          </div>
        )}
      </section>

      {/* ========================================= */}
      {/* FLOTA Y TRIPULACIÓN (base de conocimiento) */}
      {/* ========================================= */}
      <FleetKnowledgePanel />

      {/* ========================================= */}
      {/* PANEL DE DISPOSITIVOS ACTIVOS             */}
      {/* ========================================= */}
      <DispositivosPanel />

      {/* ========================================= */}
      {/* REGISTRO DE AUDITORIA Y FALLAS            */}
      {/* ========================================= */}
      <AuditoriaPanel />

      {/* ========================================= */}
      {/* MODAL DE EDICIÓN                          */}
      {/* ========================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant/20 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            
            <div className="p-6 bg-primary-container text-on-primary">
              <h2 className="font-headline-sm font-bold">Editar Usuario</h2>
              <p className="font-body-sm opacity-80 mt-1">{editingUser.email}</p>
            </div>

            <div className="p-6 flex flex-col gap-6">
              {/* Autorización */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-label-md font-bold text-on-surface">Acceso a la plataforma</h4>
                  <p className="font-body-sm text-on-surface-variant">Autorizar la entrada al sistema.</p>
                </div>
                <button
                  onClick={() => setTempStatus(tempStatus === 'aprobado' ? 'pendiente' : 'aprobado')}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
                    tempStatus === 'aprobado' ? 'bg-emerald-500' : 'bg-surface-variant'
                  }`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                    tempStatus === 'aprobado' ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Nombre */}
              <div className="flex flex-col gap-2">
                <label className="font-label-md font-bold text-on-surface">Nombre Completo</label>
                <input 
                  type="text"
                  value={tempNombre}
                  onChange={(e) => setTempNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="h-12 px-4 rounded-xl bg-surface-container text-on-surface font-label-md focus:outline-none focus:ring-2 ring-primary/20 placeholder:text-on-surface-variant/50"
                />
              </div>

              {/* Rol */}
              <div className="flex flex-col gap-2">
                <label className="font-label-md font-bold text-on-surface">Rol del Sistema</label>
                <select 
                  value={tempRole}
                  onChange={(e) => setTempRole(e.target.value as User['role'])}
                  className="h-12 px-4 rounded-xl bg-surface-container text-on-surface font-label-md focus:outline-none focus:ring-2 ring-primary/20"
                >
                  <option value="usuario">Usuario Estándar</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>

              {/* Cargo */}
              <div className="flex flex-col gap-2">
                <label className="font-label-md font-bold text-on-surface">Cargo / Puesto</label>
                <input 
                  type="text"
                  value={tempCargo}
                  onChange={(e) => setTempCargo(e.target.value)}
                  placeholder="Ej. Piloto, Gerente..."
                  className="h-12 px-4 rounded-xl bg-surface-container text-on-surface font-label-md focus:outline-none focus:ring-2 ring-primary/20 placeholder:text-on-surface-variant/50"
                />
              </div>

              {/* Acceso */}
              <div className="flex flex-col gap-2">
                <label className="font-label-md font-bold text-on-surface">Acceso</label>
                <button
                  type="button"
                  onClick={handleSendReset}
                  disabled={isSendingReset || isSaving || isDeleting}
                  className="h-12 px-4 rounded-xl bg-surface-container text-on-surface font-label-md font-bold hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isSendingReset ? "animate-spin" : ""}`}>
                    {isSendingReset ? "sync" : "lock_reset"}
                  </span>
                  {isSendingReset ? "Enviando..." : "Enviar enlace para restablecer contraseña"}
                </button>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  El usuario recibe un correo para crear una contraseña nueva. Tú no la ves en ningún momento.
                </p>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low flex justify-between items-center gap-3">
              <button 
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="px-4 py-2.5 rounded-full font-label-md font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                {isDeleting ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                )}
                Eliminar
              </button>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setEditingUser(null)}
                  className="px-6 py-2.5 rounded-full font-label-md font-bold text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
                  disabled={isSaving || isDeleting}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving || isDeleting}
                  className="px-6 py-2.5 rounded-full font-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">save</span>
                  )}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
