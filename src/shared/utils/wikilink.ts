/**
 * Extracts wikilinks formatted as [[Nama Note]] from note content.
 * Returns a unique array of trimmed note titles.
 */
export function extractWikilinks(content: string): string[] {
  if (!content) return [];
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const rawTitle = match[1].trim();
    if (rawTitle && !links.includes(rawTitle)) {
      links.push(rawTitle);
    }
  }

  return links;
}
