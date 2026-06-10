import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'La URL es requerida' }, { status: 400 });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'La URL no es válida. Asegúrate de incluir http:// o https://' }, { status: 400 });
    }

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `No se pudo obtener el artículo: ${response.status} ${response.statusText}` }, { status: 500 });
    }

    const html = await response.text();

    // Parse with JSDOM
    const dom = new JSDOM(html, { url });
    
    // Check if Readability can parse it
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return NextResponse.json({ error: 'No se pudo extraer contenido legible de este sitio web. Intenta copiarlo manualmente.' }, { status: 422 });
    }

    // Parse readability's clean HTML content using JSDOM to split it into structural paragraphs/headers
    const contentDom = new JSDOM(article.content || '');
    const doc = contentDom.window.document;
    
    // Select elements that represent paragraphs, list items or headers
    const elements = doc.querySelectorAll('p, h1, h2, h3, h4, li');
    const paragraphs: string[] = [];
    
    elements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text) {
        // We include header lines as section headers and paragraphs of reasonable length
        const isHeader = ['H1', 'H2', 'H3', 'H4'].includes(el.tagName);
        if (isHeader || text.length > 20) {
          paragraphs.push(text);
        }
      }
    });

    // Fallback if DOM traversal yielded nothing
    if (paragraphs.length === 0 && article.textContent) {
      const rawLines = article.textContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 20);
      paragraphs.push(...rawLines);
    }

    if (paragraphs.length === 0) {
      return NextResponse.json({ error: 'No se encontraron párrafos de texto legibles.' }, { status: 422 });
    }

    // Guess domain host as author fallback
    const domain = new URL(url).hostname.replace('www.', '');
    const author = article.byline || domain;

    // Detect category
    let category = 'Tecnología';
    const combinedText = (article.title + ' ' + (article.excerpt || '') + ' ' + article.textContent).toLowerCase();
    
    if (combinedText.includes('design') || combinedText.includes('diseño') || combinedText.includes('css') || combinedText.includes('ux') || combinedText.includes('art') || combinedText.includes('arte')) {
      category = 'Diseño';
    } else if (combinedText.includes('filosofía') || combinedText.includes('philosophy') || combinedText.includes('mind') || combinedText.includes('life') || combinedText.includes('vida') || combinedText.includes('pensar')) {
      category = 'Filosofía';
    } else if (combinedText.includes('negocios') || combinedText.includes('business') || combinedText.includes('startup') || combinedText.includes('finanzas') || combinedText.includes('money') || combinedText.includes('producto')) {
      category = 'Negocios';
    } else if (combinedText.includes('ciencia') || combinedText.includes('science') || combinedText.includes('biología') || combinedText.includes('espacio') || combinedText.includes('salud') || combinedText.includes('médico')) {
      category = 'Ciencia';
    } else if (combinedText.includes('libros') || combinedText.includes('books') || combinedText.includes('literatura') || combinedText.includes('historia')) {
      category = 'Literatura';
    }

    return NextResponse.json({
      title: article.title || 'Artículo sin título',
      author: author,
      url: url,
      excerpt: article.excerpt || paragraphs[0].slice(0, 160) + '...',
      paragraphs: paragraphs,
      category: category,
    });
  } catch (error: any) {
    console.error('Error in scrape endpoint:', error);
    return NextResponse.json({ error: error.message || 'Error interno al procesar el artículo.' }, { status: 500 });
  }
}
