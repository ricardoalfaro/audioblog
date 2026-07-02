import type es from './es';

const en = {
  'header.theme': 'Theme',
  'header.importArticle': 'Import article',
  'header.shareApp': 'Share app',
  'header.shareAppText': 'Check out this amazing platform to listen to articles and newsletters as podcasts!',
  'header.linkCopied': 'Link copied to clipboard',
  'header.userOptions': 'User options',
  'header.language': 'Language',

  'theme.light': 'Light Mode',
  'theme.dark': 'Dark Mode',
  'theme.system': 'Automatic (System)',

  'footer.about': 'What is Audiodocs',
  'footer.faq': 'FAQ',
  'footer.faqSoon': 'Coming soon',

  'errorBoundary.message': 'Something went wrong while loading the app.',
  'errorBoundary.reload': 'Reload',
} satisfies Record<keyof typeof es, string>;

export default en;
