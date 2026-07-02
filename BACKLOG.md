# Backlog — Audiodocs

> **Para agentes:** Este archivo es la fuente de verdad del backlog. Léelo al inicio de cada sesión. Al completar un ítem, muévelo a `## ✅ Resueltos` e incluye la actualización en el mismo commit del fix. Al descubrir un bug o mejora durante el trabajo, agrégalo aquí con prioridad y esfuerzo estimado.

---

## 🔴 Alta prioridad

| # | Título | Descripción | Esfuerzo |
|---|--------|-------------|----------|

---

## 🟡 Media prioridad

| # | Título | Descripción | Esfuerzo |
|---|--------|-------------|----------|
| F-1 | Sesión de usuario con OAuth | Login con Google (NextAuth o similar). Permite sincronizar artículos entre dispositivos y habilitar features de cuenta. Prerequisito para Gmail import | L |
| F17 | i18n de mensajes de error dinámicos | F7 tradujo toda la UI estática, pero los mensajes de error de `/api/scrape`, `/api/tts` y los que arma el cliente en sus catch (scrapeError, manualError, "Error al cargar el artículo.", etc.) siguen hardcodeados en español — requiere internacionalizar también las respuestas de esas APIs (pasar `locale` en el request, o traducir client-side al recibir el error) | M |
| F15 | Onboarding para usuario nuevo | 🚧 **BLOQUEADO** — falta que el usuario suba el JSON de artículos de muestra pre-scrapeados por categoría (ver detalle abajo). Pantalla posterior al splash (U10), solo la primera vez, con opción de saltar. Pide nombre (sin OAuth aún, se guarda en localStorage) y preferencias de lectura por selección múltiple sobre `STATIC_CATEGORIES` (`src/lib/categories.ts`). Saludo de bienvenida tipo "te recomendaremos artículos de tus temas de interés para que pruebes, luego podés importar los tuyos". Al terminar, la librería se puebla con artículos de muestra pre-scrapeados (objeto `Article` completo, no URLs a scrapear en vivo) filtrados por las categorías elegidas — requiere un JSON seed nuevo (a proveer) con varios artículos por categoría, similar a `src/data/defaultArticles.ts` pero sí usado para poblar en el primer uso. Requiere key de localStorage propia (distinta a `audiodocs_onboarded` del splash). **Falta:** el usuario debe subir/pasar el JSON con artículos completos (título, autor, párrafos, imagen, categoría) para al menos 2-3 artículos por cada categoría de `STATIC_CATEGORIES` | L |

---

## ✅ Resueltos (no reabrir)

| # | Título | Commit / Sesión |
|---|--------|-----------------|
| B15 | Import de Medium en dominios custom devolvía contenido truncado en silencio: `uxdesign.cc` y otras publicaciones con dominio propio responden 200 OK con Readability parseando el preview cortado del muro de pago, sin ningún error visible. `isMediumPoweredHtml()` detecta Medium vía meta tags `al:ios:app_name`/`al:android:app_name` (sin depender del host), `isMediumPaywalledHtml()` detecta `"isAccessibleForFree":false` en el JSON-LD, y `getMediumFeedUrl()` prueba `<dominio>/feed` para dominios custom. Validado en vivo con un artículo real recuperado completo (226 párrafos). Para artículos genuinamente member-only sin RSS ni snapshot de archive.org, ahora informa el error en vez de importar contenido cortado | sesión 2026-07-02 |
| B14 | Scroll horizontal feo en el reader: `html`/`body` sin `overflow-x:hidden`, el sidebar off-canvas (`position:fixed` + `translateX(100%)`) generaba scroll horizontal fantasma en Safari/iOS (quirk conocido de esa combinación) | sesión 2026-07-02 |
| F7 | i18n de la interfaz: `LocaleContext` (provider + hook `useLocale` + persistencia `localStorage`) con diccionarios ES/EN/PT/FR/DE en `src/lib/i18n/` (español fuente de verdad, resto validado por tipos vía `satisfies`). Selector de idioma en el dropdown del avatar (`HeaderActions.tsx`), junto al de Tema. Traducidas todas las superficies estáticas: HeaderActions, ThemeSwitcher, Footer, ErrorBoundary (class component, consume el context vía `static contextType`), `about` (dividido en Server Component con metadata + `AboutContent.tsx` client), `AppClient.tsx` completo (biblioteca, cards, modal de import) y el reader (sidebar, hero con fecha locale-aware, controles, compartir/reproducir). Fuera de alcance documentado: mensajes de error dinámicos → ver F17 | sesión 2026-07-02 |
| F13 | Importar artículos Medium member-only gratuitos: `/api/scrape` detecta host de Medium bloqueado por su challenge de Cloudflare y arma cascada `RSS del autor/publicación → archive.org`. El RSS (`medium.com/feed/@usuario` o `/feed/publicación`, derivado de la URL sin fetch previo) entrega el artículo completo sin muro de pago — matcheado por el hash estable al final de la URL/guid, no por el slug (que puede variar). Si tampoco hay snapshot en archive.org, error específico sugiriendo el "friend link" o import manual. Validado en vivo end-to-end contra un artículo real bloqueado (RSS) y contra el mecanismo de snapshot de archive.org por separado | sesión 2026-07-02 |
| F8 | Compartir artículo con idioma de traducción: `Article.translateTo` guarda el idioma con el que se importó (si aplica); `handleShare` del reader agrega `&lang=` al deep link; el auto-import de `AppClient.tsx` (`pendingAutoImportRef`, ahora `{url, lang}`) lee ese `lang` y lo pasa como override a `runScrape` para que el receptor importe ya traducido al mismo idioma | sesión 2026-07-02 |
| F16 | Acortar link de artículo compartido: nuevo endpoint `/api/shorten` (server-side, valida que la URL sea del propio origen antes de pegarle a TinyURL — no queda expuesto como shortener abierto) llamado desde `handleShare` antes de compartir/copiar. Si el acortador falla o tarda (timeout 5s), cae al link largo original sin bloquear el share | sesión 2026-07-02 |
| B12 | AbortError falso en play() del reproductor: la promesa de `.play()` en `setupAndPlay` y en la rama "reanudar" de `handlePlayPause` ahora ignora `AbortError` (interrupción esperada por una acción más reciente que reasigna `src`/llama `pause()`) y descarta callbacks de sesiones de reproducción superadas (`playSessionRef`), en vez de mostrar el mensaje de error aunque la reproducción nueva funcione bien. De paso se agregó el `.catch` que faltaba en la rama "reanudar" | sesión 2026-07-02 |
| B13 | Artwork pixelado en Now Playing / lock screen: cuando el artículo no tiene `imageUrl`, `mediaSession.metadata.artwork` ahora usa explícitamente `/android-chrome-192x192.png` y `/android-chrome-512x512.png` con sus `sizes` declarados, en vez de quedar `undefined` (que hacía que iOS recurriera a un favicon chico estirado) | sesión 2026-07-02 |
| B11 | Voseo argentino en bajada del link compartido: `src/app/(site)/app/page.tsx` — "Escuchá este artículo..." → "Escucha este artículo como podcast en Audiodocs." (español neutro) | sesión 2026-07-02 |
| U11 | Cards en mobile como fichas apiladas: efecto naipe (card angosta al 70vw + solape del 90% vía `useStackedCarousel`, deja asomar solo el borde derecho de la siguiente). z-index dinámico mantiene la card activa al frente durante el scroll. Tocar la porción asomada de una card no activa la trae al frente en vez de abrir el artículo (intercepción de click en fase de captura) — evita entrar directo a una card no totalmente visible. Fix de sombra recortada por el `overflow-x:auto` del carousel (padding+margin compensatorio) | sesión 2026-07-02 |
| B10 | Vista previa de link compartido mostraba marca genérica de Audiodocs en vez del artículo. `/app/page.tsx` se separó en Server Component (con `generateMetadata` dinámica leyendo `?ogTitle=&ogImage=`) + `AppClient.tsx`; `handleShare` en el reader arma el link con esos params tomados del artículo en memoria (sin re-scrapear) | sesión 2026-07-01 |
| F12 | Voz según género del autor: `/api/scrape` detecta género con genderize.io (server-side, en paralelo con traducción/categoría) y el import autoselecciona voz Edge masculina/femenina según el idioma en curso (`EDGE_VOICES` ahora tiene campo `gender`). Solo aplica a importados por URL, no a manuales | sesión 2026-07-01 |
| F11 | Cortina musical al iniciar: jingle.mp3 se reproduce antes del TTS solo al arrancar el artículo desde el principio (no al resumir/saltar párrafos). Timeout de seguridad de 8s por si el archivo no carga/termina, para no bloquear la escucha | sesión 2026-07-01 |
| F14 | Pull-to-refresh: al arrastrar hacia abajo estando en el tope del scroll, ícono/spinner y recarga de la app al soltar (componente PullToRefresh, gesto táctil global) | sesión 2026-07-01 |
| B9 | Barra "Volver a la biblioteca" del reader flotaba separada del header al hacer scroll (position:fixed vs sticky del header). Cambiada a sticky, mismo mecanismo que .tabs-container | sesión 2026-07-01 |
| F9 | Media Session API: metadata (título/autor/imagen) + action handlers (play/pause, anterior, siguiente) en AudioPlayerContext | sesión 2026-06-30 |
| U10 | Splash solo en mobile y solo la primera vez (localStorage `audiodocs_onboarded`) | `HEAD` |
| F10 | Web Share Target: `share_target` en el manifest + auto-import desde `url`/`text`/`title` compartidos | `HEAD` |
| U8 | Etiquetas en botones del reader (Opciones/Compartir) en desktop, icono solo en mobile | `HEAD` |
| U9 | Avatar genérico (fa-user) en vez de letra inicial, sin OAuth | `HEAD` |
| B8 | App no interactiva en el teléfono con el dev server (botones muertos): Next 16 bloquea recursos `/_next` cross-origin desde la IP de la red local → no hidrata. Fix: `allowedDevOrigins` (solo dev) | `HEAD` |
| B7 | Splash: cierre robusto por timer de JS (no solo `onAnimationEnd`) — mejora de robustez, no era el bug del teléfono | `HEAD` |
| B6 | Logo animado del splash cortado en mobile | `HEAD` |
| C3 | Refactor AudioPlayerContext (audioUtils, articleStorage, useQueue) | `fd78b18` |
| U1 | Progreso por tiempo real ponderado por palabras | `main` |
| F5 | OpenGraph + metadataBase en root layout | `main` |
| F6 | Fallback MyMemory cuando Google Translate falla | `main` |
| B5 | Delete no elimina artículos | `d8138db` |
| U7 | Confirmación de delete: overlay sobre la card (dark/light) | `ff13e57` |
| U3 | Auto-scroll vs scroll manual en reader | `fix/u3-autoscroll` |
| P2 | Memoizar parseTokens en reader | `89e18e2` |
| B1 | Voice stale en double-buffer | `94d21c9` |
| B2 | Race condition engine al cambiar artículo | `94d21c9` |
| R2 | TTS sin timeout ni retry visible | `a9aa5a9` |
| C5 | localStorage sin validación de esquema | `fd06f05` |
| P1 | fetchArticles en cada párrafo | sesión 2026-06-25 |
| P3 | prefers-reduced-motion en cardPan | sesión 2026-06-25 |
| U2 | window.confirm → confirmación dos pasos | sesión 2026-06-25 |
| U4 | Paso "Traduciendo texto" en import | sesión 2026-06-25 |
| C1 | EDGE_VOICES unificado en AudioPlayerContext | sesión 2026-06-25 |
| L1 | Lint 0 errores | sesión 2026-06-25 |
| A1 | Contraste text-muted #595959 | sesión 2026-06-25 |
| A2 | :focus-visible en player | sesión 2026-06-25 |
| A3 | role=dialog + aria-modal en modal | sesión 2026-06-25 |
| F-2 | Cola de reproducción completa | sesión 2026-06-25 |
| S1 | SSRF en scraper | pre-sesión |
| S3 | TTS vía GET expone texto en URL | pre-sesión |
| R1 | Timeout scraper | pre-sesión |
| R3 | Stack trace expuesto en errores | pre-sesión |
| R4 | Validación de tamaño de archivo | pre-sesión |
| B3 | Blob leak en reproductor | pre-sesión |
| U5 | Categorías vacías visibles | pre-sesión |
| U6 | Font Awesome vía CDN externo | pre-sesión |
| C4 | Pruning inicial de código muerto | pre-sesión |
| F0 | PWA icons | pre-sesión |
| D1 | README | pre-sesión |

---

## 🚫 Descartados

| # | Título | Razón |
|---|--------|-------|
| F1 | Import por lotes | No se hará |
| F2 | Favoritos | No se hará |
| F3 | Estadísticas | No se hará |
| F4 | Offline / IndexedDB | Solo al final de todo cuando no quede nada más |

---

**Leyenda de esfuerzo:** XS (<1h) · S (1-3h) · M (medio día) · L (1-2 días)
