"use client";

import { useState } from "react";
import { updateUserStatus, updateUserRole, updateUserCargo, deleteUserAction, updateUserName } from "@/app/actions/admin";
import { toast } from "sonner";

import { SettingsWidget } from "./SettingsWidget";
import { ApiManagementWidget } from "./ApiManagementWidget";
import { DispositivosPanel } from "./DispositivosPanel";
import { AuditoriaPanel } from "./AuditoriaPanel";

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
      toast.custom((t) => (
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
    } catch (error) {
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
    } catch (error: any) {
      toast.error(`Error al eliminar usuario: ${error.message}`);
    } finally {
      setIsDeleting(false);
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
      {/* TARJETA DE RESUMEN E HISTÓRICO            */}
      {/* ========================================= */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">group</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Gestión de Usuarios</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">{users.length} en plantilla total</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 md:gap-8 bg-surface-container-low p-4 rounded-2xl md:bg-transparent md:p-0 md:rounded-none">
          <div className="flex flex-col">
            <span className="font-label-sm text-[10px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Activos</span>
            <span className="font-headline-md text-headline-md font-bold text-on-surface mt-1">{activos}</span>
          </div>
          <div className="flex flex-col border-l border-outline-variant/30 pl-4 md:pl-8">
            <span className="font-label-sm text-[10px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pendientes</span>
            <span className="font-headline-md text-headline-md font-bold text-secondary mt-1">{pendientes}</span>
          </div>
          <div className="flex flex-col border-l border-outline-variant/30 pl-4 md:pl-8">
            <span className="font-label-sm text-[10px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Admins</span>
            <span className="font-headline-md text-headline-md font-bold text-primary mt-1">{administradores}</span>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* VISTA DESKTOP (Tabla)                     */}
      {/* ========================================= */}
      <div className="hidden md:block bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-md text-label-md border-b border-outline-variant/30 uppercase tracking-wider">
                <th className="p-5 font-semibold">Usuario</th>
                <th className="p-5 font-semibold text-center">Estado</th>
                <th className="p-5 font-semibold">Rol</th>
                <th className="p-5 font-semibold">Cargo</th>
                <th className="p-5 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {(showAllUsers ? users : users.slice(0, 5)).map(user => (
                <tr key={user.id} className="hover:bg-surface-container-lowest/50 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-bold text-sm shadow-sm">
                        {user.nombre ? user.nombre.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface font-bold">
                          {user.nombre || "Sin Nombre"}
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${user.status === 'aprobado' ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-variant text-on-surface-variant'}`}>
                      {user.status === 'aprobado' ? 'Activo' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="p-5 font-label-md text-on-surface capitalize">
                    {user.role}
                  </td>
                  <td className="p-5 font-label-md text-on-surface">
                    {user.cargo || <span className="text-on-surface-variant/50 italic">Sin asignar</span>}
                  </td>
                  <td className="p-5 text-right">
                    <button 
                      onClick={() => openEditModal(user)}
                      className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm font-bold rounded-full transition-colors flex items-center gap-2 ml-auto"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================= */}
      {/* VISTA MÓVIL (Tarjetas)                    */}
      {/* ========================================= */}
      <div className="md:hidden flex flex-col gap-4">
        {(showAllUsers ? users : users.slice(0, 5)).map(user => (
          <div key={user.id} className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4 relative">
            <div className="flex items-center gap-4 pr-10">
              <div className="w-12 h-12 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                {user.nombre ? user.nombre.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-label-md text-label-md text-on-surface font-bold truncate">
                  {user.nombre || "Sin Nombre"}
                </div>
                <div className="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">
                  {user.email}
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => openEditModal(user)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>

            <div className="h-px w-full bg-outline-variant/20 my-1"></div>

            <div className="flex justify-between items-center text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Estado</span>
                <span className={`font-semibold mt-0.5 ${user.status === 'aprobado' ? 'text-emerald-600' : 'text-on-surface-variant'}`}>
                  {user.status === 'aprobado' ? 'Activo' : 'Pendiente'}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Rol / Cargo</span>
                <span className="font-semibold text-on-surface mt-0.5 capitalize">
                  {user.role} <span className="text-on-surface-variant opacity-50 mx-1">•</span> {user.cargo || 'Sin asignar'}
                </span>
              </div>
            </div>
          </div>
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
                  onChange={(e) => setTempRole(e.target.value as any)}
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
