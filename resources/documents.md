# Objetivo del proyecto

Crear una aplicación web de estadísticas aeroportuarias y control de pasajeros para el Aeropuerto Enrique Malek, usando documentos html y css que te pasare como referencia para el frontend, Supabase para backend/base de datos y Vercel para el despliegue.

El proyecto parte de un entorno en blanco. El objetivo es implementar el diseño y las funcionalidades básicas de un dashboard administrativo moderno, limpio y enfocado en la visualización de datos, siguiendo exactamente la estructura de los datos presentados en los archivos de referencia "DATA agosto 2026.xlsx" y "Estadistica de movimiento de pasajeros de aerolineas .xlsx" que se encuentran en la carpeta del proyecto.

# Requerimientos Técnicos y Arquitectura

Autenticación: Inicio de sesión obligatorio usando Google Auth.

Base de Datos (Supabase): Necesitamos dos tablas separadas:

air_panama_diario: Para los registros diarios detallados exclusivos de Air Panama.

registro_mensual_general: Para el consolidado mensual de todos los vuelos (Air Panama, Copa Airlines, vuelos privados).

Flujos de Usuario:

Un menú principal con botones para "Agregar información diaria" (formulario manual) y "Ver tablas por mes".

Un procesador de archivos: Una función donde el usuario suba un archivo .xlsx (como los de referencia), el sistema extraiga los datos, los transforme a un formato tipo CSV en memoria, y los inserte automáticamente en la base de datos de Supabase.

Vistas de Análisis: Un módulo visual con tablas y gráficos para comparar estadísticas por año, por mes y por día.

# Instrucción Inicial para Antigravity:
Confirma que entiendes el alcance del proyecto. Como primer paso, no escribas todo el código de golpe. Devuélveme únicamente:

La estructura de carpetas sugerida para este proyecto.

El esquema de base de datos (código SQL) exacto para crear las tablas air_panama_diario y registro_mensual_general en Supabase basándote en esta descripción.