import type es from './es';

const pt = {
  'header.theme': 'Tema',
  'header.importArticle': 'Importar artigo',
  'header.shareApp': 'Compartilhar app',
  'header.shareAppText': 'Confira esta incrível plataforma para ouvir artigos e newsletters como podcasts!',
  'header.linkCopied': 'Link copiado para a área de transferência',
  'header.userOptions': 'Opções do usuário',
  'header.language': 'Idioma',

  'theme.light': 'Modo Claro',
  'theme.dark': 'Modo Escuro',
  'theme.system': 'Automático (Sistema)',

  'footer.about': 'O que é o Audiodocs',
  'footer.faq': 'FAQ',
  'footer.faqSoon': 'Em breve',

  'errorBoundary.message': 'Algo deu errado ao carregar o app.',
  'errorBoundary.reload': 'Recarregar',
} satisfies Record<keyof typeof es, string>;

export default pt;
