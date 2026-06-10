import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Article } from '@/types';

const filePath = path.join(process.cwd(), 'src/data/articles.json');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fs.readFile(filePath, 'utf-8');
    const articles: Article[] = JSON.parse(data);
    const article = articles.find((a) => a.id === id);

    if (!article) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al obtener el artículo' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fs.readFile(filePath, 'utf-8');
    let articles: Article[] = JSON.parse(data);
    
    const initialLength = articles.length;
    articles = articles.filter((a) => a.id !== id);
    
    if (articles.length === initialLength) {
      return NextResponse.json({ error: 'Artículo no encontrado o ya eliminado' }, { status: 404 });
    }
    
    await fs.writeFile(filePath, JSON.stringify(articles, null, 2), 'utf-8');
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al eliminar el artículo' }, { status: 500 });
  }
}
