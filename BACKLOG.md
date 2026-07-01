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
| F13 | Importar artículos Medium member-only gratuitos | Cascada: URL directa → RSS del autor → archive.org. Si todo falla, sugerir al usuario copiar el "friend link" de Medium (bypasea el muro sin pago) | M |
| U10 | Splash solo en mobile y primera vez | Mostrar el splash únicamente en dispositivos móviles y solo la primera vez que se abre la app. Usar `localStorage` para recordar si ya se mostró | XS |
| F12 | Voz según género del autor | Detectar género del primer nombre del autor con genderize.io (free tier) y autoseleccionar voz masculina o femenina acorde al idioma en curso. Solo si el artículo no tiene preferencia de voz guardada | S |
| F11 | Cortina musical al iniciar | Jingle breve (~1-2s) antes de que arranque el TTS, como Substack. Archivo `/public/jingle.mp3` a proveer por el usuario; `playArticle` espera `onended` del clip antes de llamar al motor TTS | S |
| F8 | Compartir artículo con idioma de traducción | Deep link `/app?url=...&lang=es` — receptor importa ya traducido al mismo idioma. Requiere guardar `translateTo` en `Article` y leerlo en el auto-import | M |
| F7 | i18n de la interfaz | El usuario selecciona el idioma de la UI desde el dropdown del avatar. Idiomas soportados: Español (default), Inglés, Portugués, Francés y Alemán. Preferencia guardada en `localStorage` | M |
| F9 | Media Session API | Lock screen y Control Center muestran título, autor e imagen del artículo en vez del ícono de la app. Incluye action handlers (play/pause, anterior, siguiente) | XS |
| F-1 | Sesión de usuario con OAuth | Login con Google (NextAuth o similar). Permite sincronizar artículos entre dispositivos y habilitar features de cuenta. Prerequisito para Gmail import | L |

---

## ✅ Resueltos (no reabrir)

| # | Título | Commit / Sesión |
|---|--------|-----------------|
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
