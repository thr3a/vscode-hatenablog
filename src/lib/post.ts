import type { HatenaClient } from '#lib/client';
import { buildFrontMatter, extractTitle, parseFrontMatter, type AtomEntry } from '#lib/hatena';

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
	promptCategories(options: { defaultValue: string }): PromiseLike<string | undefined>;
	now(): Date;
}

export type PostMarkdownResult =
	| { status: 'error'; message: string }
	| { status: 'cancelled' }
	| {
		status: 'success';
		action: '投稿' | '更新';
		title: string;
		newContent: string;
	};

export async function postMarkdownDocument(
	input: PostMarkdownInput,
	deps: PostMarkdownDeps,
): Promise<PostMarkdownResult> {
	const validationError = validatePostInput(input);
	if (validationError) {
		return { status: 'error', message: validationError };
	}

	const { frontMatter, body } = parseFrontMatter(input.fullText);
	const title = extractTitle(body);
	const categoriesInput = await deps.promptCategories({
		defaultValue: frontMatter?.categories?.join(',') ?? '',
	});

	if (categoriesInput === undefined) {
		return { status: 'cancelled' };
	}

	const categories = categoriesInput
		.split(',')
		.map((category) => category.trim())
		.filter((category) => category.length > 0);

	try {
		const entry = await deps.client.submitEntry({
			hatenaId: input.config.hatenaId,
			blogId: input.config.blogId,
			apiKey: input.config.apiKey,
			title,
			content: body,
			categories,
			entryId: frontMatter?.id,
		});

		return {
			status: 'success',
			action: frontMatter?.id ? '更新' : '投稿',
			title: entry.title || title,
			newContent: buildUpdatedMarkdown({
				entry,
				title,
				categories,
				body,
				now: deps.now(),
			}),
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
	title: string;
	categories: string[];
	body: string;
	now: Date;
}): string {
	const date = params.entry.published
		? params.entry.published.split('T')[0]
		: params.now.toISOString().split('T')[0];
	const frontMatter = buildFrontMatter({
		id: params.entry.id,
		title: params.entry.title || params.title,
		date,
		categories: params.entry.categories.length > 0 ? params.entry.categories : params.categories,
		published_at: params.entry.published,
		updated_at: params.entry.updated,
		draft_flag: params.entry.draft,
	});

	return `${frontMatter}\n${params.body}`;
}
