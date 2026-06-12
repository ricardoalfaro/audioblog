import { NextResponse } from 'next/server';
import { parseHTML } from 'linkedom';
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

    // Parse with linkedom
    const { document } = parseHTML(html);
    
    // Check if Readability can parse it
    const reader = new Readability(document);
    const article = reader.parse();

    // Try to extract an og:image
    let imageUrl = '';
    const metaImages = [
      document.querySelector('meta[property="og:image:secure_url"]'),
      document.querySelector('meta[property="og:image"]'),
      document.querySelector('meta[name="twitter:image"]'),
      document.querySelector('meta[property="twitter:image"]'),
      document.querySelector('link[rel="image_src"]')
    ];
    
    for (const meta of metaImages) {
      if (meta) {
        const content = meta.getAttribute('content') || meta.getAttribute('href');
        if (content && content.startsWith('http')) {
          imageUrl = content;
          break;
        }
      }
    }

    if (!imageUrl && article?.content) {
      const { document: articleDoc } = parseHTML(article.content);
      const firstImg = articleDoc.querySelector('img');
      if (firstImg) {
        const src = firstImg.getAttribute('src');
        if (src && src.startsWith('http')) {
          imageUrl = src;
        }
      }
    }

    if (!article) {
      return NextResponse.json({ error: 'No se pudo extraer contenido legible de este sitio web. Intenta copiarlo manualmente.' }, { status: 422 });
    }

    // Parse readability's clean HTML content using linkedom to split it into structural paragraphs/headers
    const { document: doc } = parseHTML(article.content || '');
    
    let paragraphs: string[] = [];
    let currentParagraph: string[] = [];

    // Recursive in-order traversal to extract text structures safely
    function traverse(node: any) {
      if (!node) return;
      
      const nodeType = node.nodeType;
      
      // TEXT_NODE
      if (nodeType === 3) {
        // node.textContent in linkedom for text nodes is node.nodeValue
        const text = (node.nodeValue || node.textContent || '').trim();
        if (text) {
          currentParagraph.push(text);
        }
        return;
      }

      // ELEMENT_NODE
      if (nodeType === 1) {
        const tagName = (node.tagName || '').toUpperCase();
        
        // Skip figures, captions, images, superscripts (like "Imagen generada con IA"), scripts
        if (['FIGURE', 'FIGCAPTION', 'IMG', 'PICTURE', 'SUP', 'SUB', 'STYLE', 'SCRIPT'].includes(tagName)) {
          return;
        }

        // Convert <br> tags to newlines
        if (tagName === 'BR') {
          currentParagraph.push('\n');
          return;
        }

        const isBlock = ['P', 'H1', 'H2', 'H3', 'H4', 'LI', 'DIV', 'ARTICLE', 'SECTION', 'UL', 'OL', 'BLOCKQUOTE'].includes(tagName);

        // Flush before traversing children if we hit a block boundary
        if (isBlock && currentParagraph.length > 0) {
          const joined = currentParagraph.join(' ').replace(/ \n /g, '\n').replace(/\n /g, '\n').trim();
          if (joined.length > 20 || ['H1','H2','H3','H4'].includes(tagName)) {
            paragraphs.push(joined);
          }
          currentParagraph = [];
        }
        
        for (let i = 0; i < node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
        }

        // Flush after traversing children if we are at a block boundary
        if (isBlock && currentParagraph.length > 0) {
          const joined = currentParagraph.join(' ').replace(/ \n /g, '\n').replace(/\n /g, '\n').trim();
          if (joined.length > 20 || ['H1','H2','H3','H4'].includes(tagName)) {
            paragraphs.push(joined);
          }
          currentParagraph = [];
        }
      }
    }

    traverse(doc);
    
    // Final flush
    if (currentParagraph.length > 0) {
      const joined = currentParagraph.join(' ').replace(/ \n /g, '\n').replace(/\n /g, '\n').trim();
      if (joined.length > 20) {
        paragraphs.push(joined);
      }
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

    // Detect category based on original text (fixed list: General, Tecnología, Diseño, Negocios, Pagos, Seguros, Fintech, Política, Historia, Economía, Noticias)
    let category = 'General';
    const combinedText = (title + ' ' + excerpt + ' ' + (article.textContent || '')).toLowerCase();
    
    if (combinedText.includes('fintech') || combinedText.includes('banca digital')) {
      category = 'Fintech';
    } else if (combinedText.includes('pagos') || combinedText.includes('payment') || combinedText.includes('stripe')) {
      category = 'Pagos';
    } else if (combinedText.includes('seguros') || combinedText.includes('insurtech') || combinedText.includes('insurance')) {
      category = 'Seguros';
    } else if (combinedText.includes('economía') || combinedText.includes('economy') || combinedText.includes('mercado') || combinedText.includes('inflación')) {
      category = 'Economía';
    } else if (combinedText.includes('negocios') || combinedText.includes('business') || combinedText.includes('startup') || combinedText.includes('empresa')) {
      category = 'Negocios';
    } else if (combinedText.includes('tecnología') || combinedText.includes('tech') || combinedText.includes('software') || combinedText.includes('ia') || combinedText.includes('ai')) {
      category = 'Tecnología';
    } else if (combinedText.includes('diseño') || combinedText.includes('design') || combinedText.includes('ux') || combinedText.includes('ui')) {
      category = 'Diseño';
    } else if (combinedText.includes('política') || combinedText.includes('politics') || combinedText.includes('gobierno') || combinedText.includes('elecciones')) {
      category = 'Política';
    } else if (combinedText.includes('historia') || combinedText.includes('history') || combinedText.includes('pasado')) {
      category = 'Historia';
    } else if (combinedText.includes('noticias') || combinedText.includes('news') || combinedText.includes('última hora') || combinedText.includes('reporte')) {
      category = 'Noticias';
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
      imageUrl,
    });
  } catch (error: any) {
    console.error('Error in scrape endpoint:', error);
    const detailedError = error.stack
      ? `${error.message}\nStack: ${error.stack.split('\n').slice(0, 3).join('\n')}`
      : error.message;
    return NextResponse.json(
      { error: detailedError || 'Error interno al procesar el artículo.' },
      { status: 500 }
    );
  }
}
