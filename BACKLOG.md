# Backlog — Audiodocs

> **Para agentes:** Este archivo es la fuente de verdad del backlog. Léelo al inicio de cada sesión. Al completar un ítem, muévelo a `## ✅ Resueltos` e incluye la actualización en el mismo commit del fix. Al descubrir un bug o mejora durante el trabajo, agrégalo aquí con prioridad y esfuerzo estimado.

---

## 🔴 Alta prioridad

| # | Título | Problema | Esfuerzo |
|---|--------|----------|----------|
| U3 | Auto-scroll vs scroll manual en reader | El scroll automático al párrafo activo pelea con el scroll del usuario | S |

---

## 🟡 Media prioridad

| # | Título | Descripción | Esfuerzo |
|---|--------|-------------|----------|
| U1 | Progreso por tiempo real | Barra de progreso cuenta párrafos, no tiempo — miente en artículos con párrafos desiguales | M |
| C3 | Refactor AudioPlayerContext | 700+ líneas mezclando TTS browser + Edge + persistencia + UI state | L |
| F5 | Compartir artículo | Deep link con metadata OpenGraph | M |
| F6 | Reemplazar Google Translate | Migrar a DeepL free (500K chars/mes) con MyMemory como fallback | M |

---

## ✅ Resueltos (no reabrir)

| # | Título | Commit / Sesión |
|---|--------|-----------------|
| B5 | Delete no elimina artículos | `d8138db` |
| U7 | Confirmación de delete: overlay sobre la card (dark/light) | `fix/u3-autoscroll` |
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
| F-1 | Auth Google / Gmail import | No priorizado |
| F7 | i18n | No priorizado |

---

**Leyenda de esfuerzo:** XS (<1h) · S (1-3h) · M (medio día) · L (1-2 días)
