export interface FrontMatter {
  id?: string;
  title?: string;
  date?: string;
  categories?: string[];
  published_at?: string;
  updated_at?: string;
  draft_flag?: boolean;
}

export interface AtomEntry {
  id: string;
  title: string;
  published: string;
  updated: string;
  categories: string[];
  draft: boolean;
}

export function parseFrontMatter(text: string): { frontMatter: FrontMatter | null; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontMatter: null, body: text };
  }

  const fm: FrontMatter = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) {
      continue;
    }

    const [, key, rawValue] = kv;
    const value = rawValue.trim();
    switch (key) {
      case 'id':
        fm.id = stripWrappingQuotes(value);
        break;
      case 'title':
        fm.title = stripWrappingQuotes(value);
        break;
      case 'date':
        fm.date = stripWrappingQuotes(value);
        break;
      case 'published_at':
        fm.published_at = stripWrappingQuotes(value);
        break;
      case 'updated_at':
        fm.updated_at = stripWrappingQuotes(value);
        break;
      case 'draft_flag':
        fm.draft_flag = value === 'true';
        break;
      case 'categories':
        fm.categories = parseCategories(value);
        break;
    }
  }

  return { frontMatter: fm, body: match[2] };
}

export function buildFrontMatter(fm: FrontMatter): string {
  const categories = (fm.categories ?? []).map((category) => `"${category}"`).join(', ');
  return [
    '---',
    `id: ${fm.id ?? ''}`,
    `title: "${fm.title ?? ''}"`,
    `date: "${fm.date ?? ''}"`,
    `categories: [${categories}]`,
    `published_at: "${fm.published_at ?? ''}"`,
    `updated_at: "${fm.updated_at ?? ''}"`,
    `draft_flag: ${fm.draft_flag ?? false}`,
    '---'
  ].join('\n');
}

export function extractTitle(body: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

export function buildEntryXml(params: {
  title: string;
  content: string;
  categories: string[];
  updatedAt?: string;
  draft?: boolean;
}): string {
  const categoryElements = params.categories
    .filter((category) => category.length > 0)
    .map((category) => `  <category term="${escapeXml(category)}" />`)
    .join('\n');
  const updatedElement = params.updatedAt ? `  <updated>${escapeXml(params.updatedAt)}</updated>\n` : '';
  const draftValue = params.draft ? 'yes' : 'no';

  return `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom"
       xmlns:app="http://www.w3.org/2007/app">
  <title>${escapeXml(params.title)}</title>
  <content type="text/x-markdown">${escapeXml(params.content)}</content>
${updatedElement}${categoryElements}
  <app:control>
    <app:draft>${draftValue}</app:draft>
  </app:control>
</entry>`;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function parseResponseXml(xml: string): AtomEntry {
  const getTag = (tag: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return match ? match[1].trim() : '';
  };

  const categories: string[] = [];
  const categoryRegex = /<category\s+term="([^"]*?)"\s*\/?>/g;
  let categoryMatch = categoryRegex.exec(xml);
  while (categoryMatch !== null) {
    categories.push(categoryMatch[1]);
    categoryMatch = categoryRegex.exec(xml);
  }

  const draftMatch = xml.match(/<app:draft>(\w+)<\/app:draft>/);
  const editLinkMatch = xml.match(/rel="edit"\s+href="[^"]*\/entry\/([^"]+)"/);

  return {
    id: editLinkMatch ? editLinkMatch[1] : getTag('id'),
    title: getTag('title'),
    published: getTag('published'),
    updated: getTag('updated'),
    categories,
    draft: draftMatch ? draftMatch[1] === 'yes' : false
  };
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^"|"$/g, '');
}

function parseCategories(value: string): string[] {
  const match = value.match(/^\[(.*)\]$/);
  if (!match) {
    return [];
  }

  const inner = match[1].trim();
  if (!inner) {
    return [];
  }

  return inner
    .split(',')
    .map((category) => stripWrappingQuotes(category.trim()))
    .filter((category) => category.length > 0);
}
