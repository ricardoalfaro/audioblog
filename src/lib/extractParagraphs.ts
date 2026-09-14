import { parseHTML } from 'linkedom';

const SKIP_TAGS = new Set([
  'FIGURE', 'FIGCAPTION', 'IMG', 'PICTURE', 'SUP', 'SUB', 'STYLE', 'SCRIPT', 'NOSCRIPT',
  'LABEL', 'CITE', 'BUTTON', 'NAV', 'FORM', 'INPUT', 'FOOTER', 'ASIDE',
]);
const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'ARTICLE', 'SECTION', 'UL', 'OL', 'BLOCKQUOTE', 'TD', 'TH']);
const HEADER_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const JUNK_RE = [/^\d+\s*min(ute)?\s*(read|de lectura)/i, /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d/i, /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+\d/i, /^press enter or (space|click)/i, /^imagen generada/i, /^image generated/i, /^(photo|foto)\s*(by|por|credit|:)/i, /^(fuente|source|credit|crédito)\s*:/i, /^--+$/, /^·+$/];

// Convierte HTML no confiable a texto plano. Nunca devuelve ni renderiza HTML, por lo que los
// scripts y atributos del documento no llegan al cliente.
export function extractParagraphs(contentHtml: string, fallbackTextContent: string): string[] {
  const { document } = parseHTML(contentHtml || '');
  const paragraphs: string[] = [];
  let current: string[] = [];
  const flush = (tagName: string) => {
    if (current.length === 0) return;
    const text = current.join(' ').replace(/\s+/g, ' ').trim();
    current = [];
    if (!text || (!HEADER_TAGS.has(tagName) && text.length < 15) || JUNK_RE.some((rx) => rx.test(text))) return;
    paragraphs.push(text);
  };
  // linkedom does not expose a useful common Node type for this tree.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (node: any): void => {
    if (!node) return;
    if (node.nodeType === 3) { const text = (node.nodeValue || '').trim(); if (text) current.push(text); return; }
    if (node.nodeType === 9) { for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]); return; }
    if (node.nodeType !== 1) return;
    const tag = (node.tagName || '').toUpperCase();
    const testId = node.getAttribute?.('data-testid') || '';
    if (SKIP_TAGS.has(tag) || ['authorName', 'storyReadTime', 'storyPublishDate', 'publicationName', 'post-footer', 'overflow-button'].some((id) => testId.includes(id))) return;
    if (tag === 'BR') { flush(tag); return; }
    const block = BLOCK_TAGS.has(tag);
    if (block) flush(tag);
    for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
    if (block) flush(tag);
  };
  walk(document);
  flush('DIV');
  if (paragraphs.length === 0 && fallbackTextContent) {
    paragraphs.push(...fallbackTextContent.split('\n').map((line) => line.trim()).filter((line) => line.length > 15 && !JUNK_RE.some((rx) => rx.test(line))));
  }
  return paragraphs;
}
