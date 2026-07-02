import type es from './es';

const fr = {
  'header.theme': 'Thème',
  'header.importArticle': 'Importer un article',
  'header.shareApp': "Partager l'app",
  'header.shareAppText': 'Découvrez cette incroyable plateforme pour écouter des articles et newsletters comme des podcasts !',
  'header.linkCopied': 'Lien copié dans le presse-papiers',
  'header.userOptions': 'Options utilisateur',
  'header.language': 'Langue',

  'theme.light': 'Mode Clair',
  'theme.dark': 'Mode Sombre',
  'theme.system': 'Automatique (Système)',

  'footer.about': "Qu'est-ce qu'Audiodocs",
  'footer.faq': 'FAQ',
  'footer.faqSoon': 'Bientôt disponible',

  'errorBoundary.message': "Une erreur s'est produite lors du chargement de l'app.",
  'errorBoundary.reload': 'Recharger',
} satisfies Record<keyof typeof es, string>;

export default fr;
