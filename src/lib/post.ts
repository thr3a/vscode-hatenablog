import type { HatenaClient } from '#lib/client';
import { type AtomEntry, buildFrontMatter, extractTitle, type FrontMatter, parseFrontMatter } from '#lib/hatena';

export interface HatenablogConfig {
  hatenaId: string;
  blogId: string;
  apiKey: string;
}

export interface PostMarkdownInput {
  languageId: string;
  fullText: string;
  config: HatenablogConfig;
}

export interface PostMarkdownDeps {
  client: HatenaClient;
  now(): Date;
}

export type PostMarkdownResult =
  | { status: 'error'; message: string }
  | { status: 'cancelled' }
  | {
      status: 'success';
      action: '投稿' | '更新';
      title: string;
      url: string;
      newContent: string;
    };

interface NormalizedFrontMatter extends FrontMatter {
  title: string;
  categories: string[];
  draft_flag: boolean;
}

export async function postMarkdownDocument(
  input: PostMarkdownInput,
  deps: PostMarkdownDeps
): Promise<PostMarkdownResult> {
  const validationError = validatePostInput(input);
  if (validationError) {
    return { status: 'error', message: validationError };
  }

  const { frontMatter, body } = parseFrontMatter(input.fullText);
  const metadata = normalizeFrontMatter(frontMatter, body);

  try {
    const entry = await deps.client.submitEntry({
      hatenaId: input.config.hatenaId,
      blogId: input.config.blogId,
      apiKey: input.config.apiKey,
      title: metadata.title,
      content: body,
      categories: metadata.categories,
      updatedAt: frontMatter?.id ? undefined : metadata.updated_at,
      draft: metadata.draft_flag,
      entryId: frontMatter?.id
    });

    return {
      status: 'success',
      action: frontMatter?.id ? '更新' : '投稿',
      title: entry.title || metadata.title,
      url: entry.url,
      newContent: buildUpdatedMarkdown({
        entry,
        metadata,
        body,
        now: deps.now()
      })
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', message };
  }
}

export function validatePostInput(input: PostMarkdownInput): string | null {
  if (input.languageId !== 'markdown') {
    return 'Markdownファイルのみ対応しています';
  }

  if (!input.config.hatenaId || !input.config.blogId || !input.config.apiKey) {
    return '設定が不足しています。hatenablog.hatenaId, hatenablog.blogId, hatenablog.apiKey を設定してください';
  }

  return null;
}

export function buildUpdatedMarkdown(params: {
  entry: AtomEntry;
  metadata: NormalizedFrontMatter;
  body: string;
  now: Date;
}): string {
  const date = params.entry.published
    ? params.entry.published.split('T')[0]
    : params.metadata.date || params.now.toISOString().split('T')[0];
  const frontMatter = buildFrontMatter({
    id: params.entry.id,
    title: params.entry.title || params.metadata.title || extractTitle(params.body),
    date,
    categories: params.entry.categories.length > 0 ? params.entry.categories : (params.metadata.categories ?? []),
    published_at: params.entry.published || params.metadata.published_at,
    updated_at: params.entry.updated || params.metadata.updated_at,
    draft_flag: params.entry.draft
  });

  return `${frontMatter}\n${params.body}`;
}

function normalizeFrontMatter(frontMatter: FrontMatter | null, body: string): NormalizedFrontMatter {
  const title = frontMatter?.title?.trim() || extractTitle(body);
  return {
    ...frontMatter,
    title,
    categories: frontMatter?.categories ?? [],
    draft_flag: frontMatter?.draft_flag ?? false
  };
}
