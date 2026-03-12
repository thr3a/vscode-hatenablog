import * as assert from 'assert';

import type { HatenaClient, SubmitEntryRequest } from '#lib/client';
import { postMarkdownDocument, validatePostInput } from '#lib/post';

class RecordingClient implements HatenaClient {
	public readonly requests: SubmitEntryRequest[] = [];

	constructor(
		private readonly response: {
			id: string;
			title: string;
			published: string;
			updated: string;
			categories: string[];
			draft: boolean;
		},
	) {}

	async submitEntry(request: SubmitEntryRequest) {
		this.requests.push(request);
		return this.response;
	}
}

suite('post workflow', () => {
	test('validatePostInput rejects non-markdown files', () => {
		assert.strictEqual(
			validatePostInput({
				languageId: 'plaintext',
				fullText: '# test',
				config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' },
			}),
			'Markdownファイルのみ対応しています',
		);
	});

	test('validatePostInput rejects missing configuration', () => {
		assert.strictEqual(
			validatePostInput({
				languageId: 'markdown',
				fullText: '# test',
				config: { hatenaId: '', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' },
			}),
			'設定が不足しています。hatenablog.hatenaId, hatenablog.blogId, hatenablog.apiKey を設定してください',
		);
	});

	test('postMarkdownDocument cancels cleanly when category prompt is dismissed', async () => {
		const client = new RecordingClient({
			id: '1',
			title: 'Test',
			published: '2026-03-11T23:47:27+09:00',
			updated: '2026-03-11T23:47:27+09:00',
			categories: ['ubuntu'],
			draft: false,
		});

		const result = await postMarkdownDocument(
			{
				languageId: 'markdown',
				fullText: '# Test\nbody',
				config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' },
			},
			{
				client,
				promptCategories: async () => undefined,
				now: () => new Date('2026-03-11T00:00:00.000Z'),
			},
		);

		assert.deepStrictEqual(result, { status: 'cancelled' });
		assert.strictEqual(client.requests.length, 0);
	});

	test('postMarkdownDocument posts new markdown and builds front matter from response', async () => {
		const client = new RecordingClient({
			id: '17179246901363868670',
			title: 'Posted Title',
			published: '2026-03-11T23:47:27+09:00',
			updated: '2026-03-11T23:48:27+09:00',
			categories: ['ubuntu', 'linux'],
			draft: false,
		});

		const result = await postMarkdownDocument(
			{
				languageId: 'markdown',
				fullText: '# Posted Title\nbody',
				config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' },
			},
			{
				client,
				promptCategories: async ({ defaultValue }) => {
					assert.strictEqual(defaultValue, '');
					return 'ubuntu, linux';
				},
				now: () => new Date('2026-03-11T00:00:00.000Z'),
			},
		);

		assert.strictEqual(client.requests.length, 1);
		assert.strictEqual(client.requests[0].entryId, undefined);
		assert.deepStrictEqual(client.requests[0].categories, ['ubuntu', 'linux']);
		assert.deepStrictEqual(result, {
			status: 'success',
			action: '投稿',
			title: 'Posted Title',
			newContent: `---
id: 17179246901363868670
title: "Posted Title"
date: "2026-03-11"
categories: ["ubuntu", "linux"]
published_at: "2026-03-11T23:47:27+09:00"
updated_at: "2026-03-11T23:48:27+09:00"
draft_flag: false
---
# Posted Title
body`,
		});
	});

	test('postMarkdownDocument updates existing markdown with PUT semantics', async () => {
		const client = new RecordingClient({
			id: '17179246901363868670',
			title: '',
			published: '',
			updated: '2026-03-12T00:00:00+09:00',
			categories: [],
			draft: false,
		});

		const result = await postMarkdownDocument(
			{
				languageId: 'markdown',
				fullText: `---
id: 17179246901363868670
title: "Old"
date: "2026-03-11"
categories: ["old"]
published_at: "2026-03-11T23:47:27+09:00"
updated_at: "2026-03-11T23:47:27+09:00"
draft_flag: false
---
# New Title
body`,
				config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' },
			},
			{
				client,
				promptCategories: async ({ defaultValue }) => {
					assert.strictEqual(defaultValue, 'old');
					return 'refactor';
				},
				now: () => new Date('2026-03-11T15:00:00.000Z'),
			},
		);

		assert.strictEqual(client.requests.length, 1);
		assert.strictEqual(client.requests[0].entryId, '17179246901363868670');
		assert.deepStrictEqual(client.requests[0].categories, ['refactor']);
		assert.deepStrictEqual(result, {
			status: 'success',
			action: '更新',
			title: 'New Title',
			newContent: `---
id: 17179246901363868670
title: "New Title"
date: "2026-03-11"
categories: ["refactor"]
published_at: ""
updated_at: "2026-03-12T00:00:00+09:00"
draft_flag: false
---
# New Title
body`,
		});
	});

	test('postMarkdownDocument returns client errors as user-facing messages', async () => {
		const result = await postMarkdownDocument(
			{
				languageId: 'markdown',
				fullText: '# Test\nbody',
				config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' },
			},
			{
				client: {
					async submitEntry() {
						throw new Error('network down');
					},
				},
				promptCategories: async () => 'ubuntu',
				now: () => new Date('2026-03-11T00:00:00.000Z'),
			},
		);

		assert.deepStrictEqual(result, { status: 'error', message: 'network down' });
	});
});
