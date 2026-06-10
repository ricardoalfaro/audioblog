import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

// Helper function to translate text using Google Translate free endpoint
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !targetLang || targetLang === 'original') return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    
    if (!res.ok) return text;
    
    const json = await res.json();
    // Google Translate returns: [[[translatedSegment, originalSegment, ...], ...], ...]
    const translatedParts = json[0]?.map((part: any) => part[0]).join('') || text;
    return translatedParts;
  } catch (error) {
    console.error('Error translating paragraph:', error);
    return text; // Fallback to original text on translation failure
  }
}

export async function POST(request: Request) {
  try {
    const { url, translateTo } = await request.json();
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
    
    let paragraphs: string[] = [];
    
    // Recursive in-order traversal to extract text structures safely without selector engines (nwsapi)
    function traverse(node: any) {
      if (!node) return;
      
      const tagName = node.tagName;
      if (tagName) {
        if (['P', 'H1', 'H2', 'H3', 'H4', 'LI'].includes(tagName)) {
          const text = node.textContent?.trim();
          if (text) {
            const isHeader = ['H1', 'H2', 'H3', 'H4'].includes(tagName);
            if (isHeader || text.length > 20) {
              paragraphs.push(text);
              return; // Stop traversal on this branch to avoid nesting/duplicate text extraction
            }
          }
        }
      }
      
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
      }
    }

    if (doc.body) {
      traverse(doc.body);
    }

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

    // Clean up title, author and excerpt
    let title = article.title || 'Artículo sin título';
    const domain = new URL(url).hostname.replace('www.', '');
    const author = article.byline || domain;
    let excerpt = article.excerpt || paragraphs[0].slice(0, 160) + '...';

    // Detect category based on original text
    let category = 'Tecnología';
    const combinedText = (title + ' ' + excerpt + ' ' + (article.textContent || '')).toLowerCase();
    
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

    // Apply translation if chosen and not 'original'
    if (translateTo && translateTo !== 'original') {
      try {
        title = await translateText(title, translateTo);
        excerpt = await translateText(excerpt, translateTo);
        
        // Translate all paragraphs in parallel (concurrently) to maintain fast speed
        paragraphs = await Promise.all(
          paragraphs.map((p) => translateText(p, translateTo))
        );
      } catch (transErr) {
        console.error('Failed to translate content:', transErr);
        // Fall back to original language on translation crash
      }
    }

    return NextResponse.json({
      title,
      author,
      url,
      excerpt,
      paragraphs,
      category,
    });
  } catch (error: any) {
    console.error('Error in scrape endpoint:', error);
    return NextResponse.json({ error: error.message || 'Error interno al procesar el artículo.' }, { status: 500 });
  }
}
