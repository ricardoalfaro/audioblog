export interface Article {
  id: string;
  title: string;
  author: string;
  url: string;
  addedAt: string;
  category: string;
  excerpt: string;
  duration: number; // in seconds
  paragraphs: string[];
  imageUrl?: string;
  progress?: number;
}
