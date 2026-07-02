import type es from './es';

const de = {
  'header.theme': 'Design',
  'header.importArticle': 'Artikel importieren',
  'header.shareApp': 'App teilen',
  'header.shareAppText': 'Schau dir diese großartige Plattform an, um Artikel und Newsletter wie Podcasts zu hören!',
  'header.linkCopied': 'Link in die Zwischenablage kopiert',
  'header.userOptions': 'Benutzeroptionen',
  'header.language': 'Sprache',

  'theme.light': 'Heller Modus',
  'theme.dark': 'Dunkler Modus',
  'theme.system': 'Automatisch (System)',

  'footer.about': 'Was ist Audiodocs',
  'footer.faq': 'FAQ',
  'footer.faqSoon': 'Demnächst',

  'errorBoundary.message': 'Beim Laden der App ist etwas schiefgelaufen.',
  'errorBoundary.reload': 'Neu laden',
} satisfies Record<keyof typeof es, string>;

export default de;
