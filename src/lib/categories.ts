export const STATIC_CATEGORIES = [
  'General', 'Tecnología', 'Diseño', 'Negocios', 'Pagos',
  'Seguros', 'Fintech', 'Política', 'Historia', 'Economía', 'Noticias',
];

export function detectCategory(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('fintech') || t.includes('banca digital')) return 'Fintech';
  if (t.includes('pagos') || t.includes('payment') || t.includes('stripe')) return 'Pagos';
  if (t.includes('seguros') || t.includes('insurtech') || t.includes('insurance')) return 'Seguros';
  if (t.includes('economía') || t.includes('economy') || t.includes('mercado') || t.includes('inflación')) return 'Economía';
  if (t.includes('negocios') || t.includes('business') || t.includes('startup') || t.includes('empresa')) return 'Negocios';
  if (t.includes('tecnología') || t.includes('tech') || t.includes('software') || t.includes('ia') || t.includes('ai')) return 'Tecnología';
  if (t.includes('diseño') || t.includes('design') || t.includes('ux') || t.includes('ui')) return 'Diseño';
  if (t.includes('política') || t.includes('politics') || t.includes('gobierno') || t.includes('elecciones')) return 'Política';
  if (t.includes('historia') || t.includes('history') || t.includes('pasado')) return 'Historia';
  if (t.includes('noticias') || t.includes('news') || t.includes('última hora') || t.includes('reporte')) return 'Noticias';
  return 'General';
}
