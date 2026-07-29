<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Backlog

`BACKLOG.md` en la raíz del proyecto es la fuente de verdad del backlog.

**Al iniciar una sesión:** lee `BACKLOG.md` para conocer el estado actual.

**Al completar un ítem:** muévelo de su sección a `## ✅ Resueltos`, añade el hash del commit en la columna "Commit / Sesión", e incluye el cambio a `BACKLOG.md` en el mismo commit del fix.

**Al descubrir un bug o mejora durante el trabajo:** agrégalo al backlog con `#`, título, descripción breve, y esfuerzo estimado (XS/S/M/L). Prioridad alta (`🔴`) si bloquea al usuario; media (`🟡`) en cualquier otro caso.

**Nunca** reabras ítems ya resueltos.

# Notas de sesión (local, no versionado)

`.claude/SESSION_NOTES.md` es un snapshot local (gitignored, no se sube al repo) de en qué quedó la última sesión de trabajo. No es historial — se sobreescribe cada vez, no se acumula.

**Al iniciar una sesión:** si el archivo existe, leelo para retomar contexto (qué se estaba haciendo, qué quedó a mitad de camino, decisiones o bloqueos que el usuario todavía no resolvió) antes de empezar.

**Al cerrar una sesión de trabajo** (el usuario se despide, dice que termina por hoy, o lo pide explícitamente): reescribí el archivo con un resumen breve. No dupliques lo que ya vive en `BACKLOG.md` — esto es para contexto de continuidad (en qué estábamos, no qué falta hacer en general).
