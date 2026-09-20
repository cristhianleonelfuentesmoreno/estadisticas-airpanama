"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { updateAppSettings, getAppSettings } from "@/app/actions/admin";

export function SettingsWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [loginTitle, setLoginTitle] = useState("");
  const [loginText, setLoginText] = useState("");
  const [registerTitle, setRegisterTitle] = useState("");
  const [registerText, setRegisterText] = useState("");
  const [bgPosition, setBgPosition] = useState("center");
  const [bgSize, setBgSize] = useState("cover");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bgUrlPreview, setBgUrlPreview] = useState("/bg-plane.png");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = async () => {
    try {
      const s = await getAppSettings();
      if (s) {
        setLoginTitle(s.loginTitle || "¡Hola!");
        setLoginText(s.loginText || "Ingresa tus datos personales y empieza el viaje con nosotros.");
        setRegisterTitle(s.registerTitle || "¡Bienvenido de vuelta!");
        setRegisterText(s.registerText || "Para mantenerte conectado con nosotros, por favor inicia sesión con tu información.");
        setBgPosition(s.bgPosition || "center");
        setBgSize(s.bgSize || "cover");
        setBgUrlPreview(s.bgUrl || "/bg-plane.png");
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setBgUrlPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("loginTitle", loginTitle);
      formData.append("loginText", loginText);
      formData.append("registerTitle", registerTitle);
      formData.append("registerText", registerText);
      formData.append("bgPosition", bgPosition);
      formData.append("bgSize", bgSize);
      formData.append("bgUrl", bgUrlPreview);
      
      if (imageFile) {
        formData.append("imageFile", imageFile);
      }

      const res = await updateAppSettings(formData);
      if (res.error) throw new Error(res.error);
      
      toast.custom((t) => (
        <div className="bg-surface-container-lowest border-l-4 border-emerald-500 p-4 rounded-xl shadow-lg flex items-start gap-4">
          <div className="bg-emerald-100 text-emerald-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">check_circle</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface">¡Configuración Guardada!</h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">
              Los cambios en la página de inicio se han aplicado.
            </p>
          </div>
        </div>
      ));
      setIsOpen(false);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex items-center gap-6 hover:bg-surface-container-lowest/80 transition-colors group cursor-pointer text-left"
      >
        <div className="w-14 h-14 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center transition-transform group-hover:scale-105">
          <span className="material-symbols-outlined text-3xl">wallpaper</span>
        </div>
        <div>
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Personalizar Pantalla de Inicio</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Cambia la imagen de fondo y los textos de bienvenida.</p>
        </div>
        <div className="ml-auto w-10 h-10 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors">
          <span className="material-symbols-outlined">edit</span>
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl border border-outline-variant/20 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-primary-container text-on-primary flex justify-between items-center shrink-0">
              <div>
                <h2 className="font-headline-sm font-bold">Personalización de Inicio</h2>
                <p className="font-body-sm opacity-80 mt-1">Ajusta el diseño de la pantalla de login</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-10 h-10 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex flex-col gap-8">
              {/* Sección de Textos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <h3 className="font-label-lg font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined">login</span> Panel de Login
                  </h3>
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md font-bold text-on-surface text-xs">Título principal</label>
                    <input type="text" value={loginTitle} onChange={e => setLoginTitle(e.target.value)} className="h-10 px-3 rounded-lg bg-surface-container text-sm focus:outline-none focus:ring-2 ring-primary/20" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md font-bold text-on-surface text-xs">Texto secundario</label>
                    <textarea value={loginText} onChange={e => setLoginText(e.target.value)} className="p-3 rounded-lg bg-surface-container text-sm focus:outline-none focus:ring-2 ring-primary/20 min-h-[80px]" />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <h3 className="font-label-lg font-bold text-secondary flex items-center gap-2">
                    <span className="material-symbols-outlined">person_add</span> Panel de Registro
                  </h3>
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md font-bold text-on-surface text-xs">Título principal</label>
                    <input type="text" value={registerTitle} onChange={e => setRegisterTitle(e.target.value)} className="h-10 px-3 rounded-lg bg-surface-container text-sm focus:outline-none focus:ring-2 ring-primary/20" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md font-bold text-on-surface text-xs">Texto secundario</label>
                    <textarea value={registerText} onChange={e => setRegisterText(e.target.value)} className="p-3 rounded-lg bg-surface-container text-sm focus:outline-none focus:ring-2 ring-primary/20 min-h-[80px]" />
                  </div>
                </div>
              </div>

              {/* Separador */}
              <div className="h-px w-full bg-outline-variant/30"></div>

              {/* Sección de Imagen */}
              <div className="flex flex-col gap-6">
                <h3 className="font-label-lg font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined">image</span> Imagen de Fondo
                </h3>

                <div className="flex flex-col md:flex-row gap-6">
                  {/* Vista Previa */}
                  <div className="w-full md:w-1/2 flex flex-col gap-3">
                    <span className="font-label-md font-bold text-on-surface text-xs">Vista Previa</span>
                    <div className="w-full h-48 bg-surface-container rounded-2xl overflow-hidden border border-outline-variant/20 shadow-inner relative">
                      <div 
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${bgUrlPreview})`,
                          backgroundSize: bgSize,
                          backgroundPosition: bgPosition,
                          backgroundRepeat: 'no-repeat'
                        }}
                      />
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 w-full py-2 bg-surface-variant text-on-surface-variant rounded-xl font-label-md font-bold flex items-center justify-center gap-2 hover:bg-surface-variant/80 transition-colors"
                    >
                      <span className="material-symbols-outlined">upload</span>
                      Subir nueva imagen
                    </button>
                  </div>

                  {/* Controles */}
                  <div className="w-full md:w-1/2 flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="font-label-md font-bold text-on-surface text-xs">Tamaño de la imagen (Zoom)</label>
                      <select 
                        value={bgSize} 
                        onChange={e => setBgSize(e.target.value)}
                        className="h-10 px-3 rounded-lg bg-surface-container text-sm focus:outline-none focus:ring-2 ring-primary/20"
                      >
                        <option value="cover">Llenar todo (Recomendado)</option>
                        <option value="contain">Ajustar completo</option>
                        <option value="100%">100% (Original)</option>
                        <option value="120%">120% (Zoom in)</option>
                        <option value="150%">150% (Zoom in max)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-label-md font-bold text-on-surface text-xs">Posicionamiento</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['top left', 'top center', 'top right', 'center left', 'center', 'center right', 'bottom left', 'bottom center', 'bottom right'].map(pos => (
                          <button
                            key={pos}
                            onClick={() => setBgPosition(pos)}
                            className={`py-2 rounded-lg text-xs font-bold transition-colors ${bgPosition === pos ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                          >
                            {pos.replace('top', '↑').replace('bottom', '↓').replace('left', '←').replace('right', '→').replace('center', '•')}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-on-surface-variant text-center mt-1">Usa la cuadrícula para alinear la imagen.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low flex justify-end gap-3 shrink-0 border-t border-outline-variant/20">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 rounded-full font-label-md font-bold text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 rounded-full font-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">save</span>
                )}
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
