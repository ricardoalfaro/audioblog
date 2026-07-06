// Clases reales definidas en globals.css (card-gradient-1..5); un artículo sin imageUrl
// cae siempre en el mismo degradado determinado por su id, tanto en las cards de la
// biblioteca (AppClient) como en el mini-thumbnail del GlobalPlayer.
export function getGradientClass(id: string): string {
  const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `card-gradient-${(sum % 5) + 1}`;
}
