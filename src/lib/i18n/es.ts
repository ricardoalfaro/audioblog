// Diccionario fuente de verdad (español). Las claves de los demás idiomas deben coincidir
// exactamente con este objeto — TS lo valida vía `satisfies Record<keyof typeof es, string>`.
const es = {
  'header.theme': 'Tema',
  'header.importArticle': 'Importar artículo',
  'header.shareApp': 'Compartir app',
  'header.shareAppText': '¡Mira esta increíble plataforma para escuchar artículos y newsletters como podcasts!',
  'header.linkCopied': 'Enlace copiado al portapapeles',
  'header.userOptions': 'Opciones de usuario',
  'header.language': 'Idioma',

  'theme.light': 'Modo Claro',
  'theme.dark': 'Modo Oscuro',
  'theme.system': 'Automático (Sistema)',

  'footer.about': 'Qué es Audiodocs',
  'footer.faq': 'FAQ',
  'footer.faqSoon': 'Próximamente',

  'errorBoundary.message': 'Algo salió mal al cargar la app.',
  'errorBoundary.reload': 'Recargar',
} as const;

export default es;
