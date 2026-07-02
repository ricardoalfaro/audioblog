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
  lastPlayedAt?: string;
  preferredEngine?: 'device' | 'edge';
  preferredEdgeVoice?: string;
  preferredVoiceName?: string;
  translateTo?: string; // idioma al que se tradujo en el import ('es' | 'en'), si aplica
}
