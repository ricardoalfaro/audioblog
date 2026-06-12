# Audioblog

Audioblog es una plataforma premium y minimalista diseñada para transformar tus artículos favoritos en una experiencia de "podcast" de alta calidad. Permite extraer texto de URLs web, organizarlo en una biblioteca personal y escucharlo utilizando voces locales (Web Speech API) o voces neuronales de alta definición (Edge TTS) con soporte nativo para reproducción en segundo plano y Apple CarPlay.

## 🚀 Características Principales

- **Diseño Premium**: Interfaz minimalista con efectos glassmorphism, paleta de colores cuidadosamente seleccionada e iconos responsivos.
- **Doble Motor de Audio**:
  - *Voz Local (Browser)*: Basado en `window.speechSynthesis`, resalta palabra por palabra a medida que el lector avanza.
  - *Voz Neuronal (Natural)*: Basado en un proxy de Microsoft Edge TTS (`/api/tts`) para generar audio hiper-realista. Compatible con mandos de hardware, bloqueo de pantalla y CarPlay.
- **Importador Inteligente**: Proporciona cualquier URL y el scraper interno basado en `cheerio` y `@mozilla/readability` limpiará el formato para obtener el texto puro.
- **Persistencia Local Segura**: Los artículos se guardan de forma offline en el `localStorage` del navegador. Se conserva un máximo de 50 artículos y se purgan automáticamente tras 30 días para mantener el rendimiento impecable.
- **Reproductor Flotante Global**: Mantiene la reproducción fluida gracias a las transiciones suaves (SPA) del enrutador de Next.js, sin interrumpir el audio mientras navegas por tu biblioteca.

## 🛠️ Stack Tecnológico

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Vanilla CSS con variables CSS nativas (`globals.css`)
- **Iconografía**: FontAwesome 6 (CDN)
- **Extracción de Contenido**: `cheerio`, `@mozilla/readability`, `jsdom` (en el lado del servidor).
- **TTS Proxy**: Implementación customizada contra los endpoints WSS de Edge Speech.

## 🏗️ Requisitos Previos

Asegúrate de tener instalado en tu máquina local:
- [Node.js](https://nodejs.org/en/) (Versión 18.17 o superior)
- `npm`, `yarn` o `pnpm`.

## 💻 Instalación y Desarrollo Local

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/audioblog.git
   cd audioblog
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

4. **Visualizar la aplicación**
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## ⚙️ Arquitectura

### 1. `AudioPlayerContext` y Persistencia del DOM
La aplicación evita interrupciones de audio al navegar al mantener todo el estado crítico (el objeto global `new Audio()`, referencias de `window.speechSynthesis`) en un proveedor ubicado dentro de `layout.tsx`. Debido al enrutamiento estático optimizado (`next/link` y `useRouter`), los componentes hijos se desmontan y rearman virtualmente sin provocar recargas forzadas (`hard refreshes`) en el navegador.

### 2. Extractor (Scraper API)
La ruta `src/app/api/scrape/route.ts` recibe URLs de clientes, hace fetch del HTML crudo y ejecuta un saneamiento usando librerías de lectura que aíslan el cuerpo central de la noticia, apartando la publicidad y barras de navegación. El texto final se fragmenta en arreglos de párrafos legibles y se calcula una estimación de la duración de lectura.

### 3. Edge TTS Proxy
Para evadir las políticas restrictivas de CORS de navegadores y ofrecer audio continuo compatible con la API de sesión multimedia del dispositivo, la ruta `src/app/api/tts/route.ts` orquesta Handshakes de WebSockets encubiertos que comunican a nuestros clientes de forma imperceptible con los servidores de síntesis neuronal.

## 📦 Producción (Deploy)

Para compilar y correr la versión optimizada:

```bash
npm run build
npm start
```
El proyecto está optimizado para funcionar y desplegarse sin fricción alguna en plataformas como **Vercel** o **Netlify**.

---
*Desarrollado con obsesión por los detalles.*
