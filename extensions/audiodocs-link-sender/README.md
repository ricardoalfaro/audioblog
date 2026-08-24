# Enviar enlace a Audiodocs

Extensión para Brave y Chrome que añade **“Abrir en Audiodocs”** al menú que aparece al hacer click derecho sobre un enlace.

Al elegir la opción, abre una pestaña nueva en `https://audiodocs.cl/app` e inicia el flujo de importación con la URL del enlace. La extensión no lee el contenido de las páginas, no accede al historial y no requiere iniciar sesión.

## Instalar en Brave

1. Abre `brave://extensions`.
2. Activa **Modo desarrollador**.
3. Presiona **Cargar extensión sin empaquetar**.
4. Elige esta carpeta: `extensions/audiodocs-link-sender`.
5. En cualquier sitio web, haz click derecho sobre el título o enlace de un artículo y elige **Abrir en Audiodocs**.

## Instalar en Chrome

Sigue los mismos pasos desde `chrome://extensions`.

## Probar

La opción solo aparece sobre enlaces web `http` o `https`. Al elegirla se abrirá una pestaña con una URL de esta forma:

```
https://audiodocs.cl/app?url=https%3A%2F%2Fejemplo.com%2Farticulo
```

Audiodocs valida e importa el enlace como si se hubiera pegado en el formulario de importación.
