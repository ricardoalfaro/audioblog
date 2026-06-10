import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Article } from '@/types';

const filePath = path.join(process.cwd(), 'src/data/articles.json');

async function getArticles(): Promise<Article[]> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export async function GET() {
  const articles = await getArticles();
  // Sort by addedAt descending (newest first)
  articles.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  return NextResponse.json(articles);
}

export async function POST(request: Request) {
  try {
    const newArticle = await request.json();
    const articles = await getArticles();
    
    // Check if article with same URL already exists (if it's not a manual entry)
    if (newArticle.url && newArticle.url !== 'manual') {
      const exists = articles.some(a => a.url.toLowerCase() === newArticle.url.toLowerCase());
      if (exists) {
        return NextResponse.json({ error: 'Este artículo ya ha sido importado.' }, { status: 400 });
      }
    }
    
    // Calculate reading duration (average speech rate is ~150-180 words per minute)
    const wordCount = newArticle.paragraphs?.join(' ').split(/\s+/).filter(Boolean).length || 0;
    const durationSeconds = Math.max(30, Math.round((wordCount / 160) * 60)); // at least 30s
    
    const article: Article = {
      id: Date.now().toString(),
      title: newArticle.title || 'Artículo sin título',
      author: newArticle.author || 'Desconocido',
      url: newArticle.url || 'manual',
      addedAt: newArticle.addedAt || new Date().toISOString(),
      category: newArticle.category || 'General',
      excerpt: newArticle.excerpt || (newArticle.paragraphs?.[0] ? newArticle.paragraphs[0].slice(0, 160) + '...' : ''),
      duration: durationSeconds,
      paragraphs: newArticle.paragraphs || [],
    };
    
    articles.push(article);
    await fs.writeFile(filePath, JSON.stringify(articles, null, 2), 'utf-8');
    
    return NextResponse.json(article);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al guardar el artículo' }, { status: 500 });
  }
}
