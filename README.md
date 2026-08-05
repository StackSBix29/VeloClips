# 🎬 VeloClips

VeloClips es una herramienta de automatización de edición de video diseñada para integrarse directamente con **DaVinci Resolve**. Proporciona una interfaz de escritorio fluida para gestionar y procesar clips de video utilizando inteligencia artificial y scripts personalizados, ejecutándose de manera silenciosa en segundo plano.

## ✨ Características Principales

* **Integración con DaVinci Resolve:** Comunicación directa con el motor de DaVinci a través de scripts en Lua y la API oficial (`fuscript.exe`).
* **Procesamiento con IA:** Utiliza scripts de Python integrados para el análisis y procesamiento avanzado de video.
* **Ejecución Silenciosa:** Los procesos backend en Windows se ejecutan sin molestas ventanas de consola interrumpiendo el flujo de trabajo.
* **Interfaz Moderna:** UI construida con React y TypeScript, empaquetada en una aplicación de escritorio ligera gracias a Tauri.
* **Instaladores Nativos:** Soporte para empaquetado en formatos MSI y NSIS listos para producción.

## ⚡ Funciones Nativas (Modo Autónomo)
VeloClips es perfectamente funcional por sí sola. Si prefieres editar en Premiere, CapCut u otro programa, la aplicación te entregará los clips crudos listos para usar.
* **Scraping Multiplataforma:** Descarga e importa VODs recientes directamente desde Twitch, Kick o YouTube.
* **Análisis de Audio (IA):** Detecta picos vocales, gritos y momentos de alta intensidad para encontrar tus mejores jugadas.
* **Análisis de Chat:** Escanea el chat de los streams en busca de "explosiones" de mensajes para identificar los momentos más virales.
* **Detección Facial (Auto-Encuadre):** Utiliza MediaPipe para encontrar rostros en pantalla y calcular las coordenadas exactas y el nivel de zoom necesario para el formato vertical.
* **Motor de Recorte Rápido:** Configura la duración de los clips (ej. 60 segundos) y el número máximo a extraer; la app procesará y exportará los videos crudos a tu carpeta local.
* **Gestor de Proyectos:** Guarda el historial de tus videos procesados (archivos locales o URLs) junto con sus marcas de tiempo para que continúes editando en otro momento.

## 🚀 Integración con DaVinci Resolve (Modo Pro)
Para los usuarios de DaVinci Resolve, VeloClips lleva la automatización al siguiente nivel mediante una conexión directa.
* **Inyección Automática de Scripts:** La app instala de forma silenciosa un script de Lua (VeloClips_Injector.lua) en las carpetas de DaVinci para recibir instrucciones desde tu interfaz.
* **Gestor de Plantillas (.drb):** Permite aplicar diseños preconfigurados directamente a la línea de tiempo de DaVinci, tales como:  Formatos Verticales (1 Cámara o Dúo).  Formato Horizontal estándar.  Fondos Inmersivos con efecto Blur.
* **Aplicación de Auto-Encuadre:** Utiliza la información de la IA facial nativa para posicionar tu cámara perfectamente en el layout del proyecto sin que tengas que ajustar los recuadros a mano.
* **Renderizado de Línea de Tiempo:** En lugar de solo entregarte videos sueltos, VeloClips acomoda los clips seleccionados directamente en el editor, listos para los toques finales.  

## 🛠️ Stack Tecnológico

* **Frontend:** React, TypeScript, Vite
* **Backend / Core:** Rust (Tauri Framework)
* **Procesamiento:** Python, Lua (DaVinci Resolve API)

## 🚀 Requisitos Previos

Si deseas ejecutar o compilar este proyecto desde el código fuente, asegúrate de tener instalado lo siguiente:

* [DaVinci Resolve Studio](https://www.blackmagicdesign.com/products/davinciresolve) (requerido para la API de scripting)
* [Node.js](https://nodejs.org/) (v16 o superior)
* [Rust](https://www.rust-lang.org/tools/install)
* [Python 3.x](https://www.python.org/downloads/)

## 📦 Instalación (Para Usuarios)

1. Ve a la pestaña de **Releases** en este repositorio.
2. Descarga el instalador más reciente (`.msi` o el ejecutable NSIS).
3. Ejecuta el instalador y sigue las instrucciones en pantalla.

## ⚙️ Configuración para Desarrollo

Si quieres contribuir o modificar el código:

1. Clona este repositorio:
   git clone https://github.com/StackSBix29/VeloClips.git
2. Entra al directorio del proyecto:
   cd VeloClips
3. Instala las dependencias del frontend:
   npm install
4. Inicia el servidor de desarrollo de Tauri:
   npm run tauri dev

## 🏗️ Compilación de Producción

Para generar los instaladores `.msi` y el ejecutable final, asegúrate de que tus scripts de Python, plantillas y archivos de DaVinci estén correctamente ubicados en la carpeta `src-tauri` para que el compilador los incluya. Luego ejecuta:

npm run tauri build

## ☕ Apoyar el proyecto

Si esta herramienta te ha resultado útil y te ha ahorrado horas de edición, considera invitarme un café. ¡Cualquier apoyo ayuda a mantener el proyecto vivo y en constante mejora!

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Apoyar%20el%20proyecto-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/stacks_bix29)

## 📄 Licencia

Este proyecto está bajo la Licencia **GNU GPLv3**. Puedes ver el archivo `LICENSE` para más detalles.

---
*Desarrollado por StackSBix29*
