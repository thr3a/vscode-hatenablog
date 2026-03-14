import * as assert from 'node:assert';

import type { HatenaClient, SubmitEntryRequest } from '#lib/client';
import { buildUpdatedMarkdown, postMarkdownDocument, validatePostInput } from '#lib/post';

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
      url: string;
    }
  ) {}

  async submitEntry(request: SubmitEntryRequest) {
    this.requests.push(request);
    return this.response;
  }
}

suite('post workflow', () => {
  test('validatePostInput: Markdownファイル以外は拒否する', () => {
    assert.strictEqual(
      validatePostInput({
        languageId: 'plaintext',
        fullText: '# test',
        config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' }
      }),
      'Markdownファイルのみ対応しています'
    );
  });

  test('validatePostInput: 設定が不足している場合は拒否する', () => {
    assert.strictEqual(
      validatePostInput({
        languageId: 'markdown',
        fullText: '# test',
        config: { hatenaId: '', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' }
      }),
      '設定が不足しています。hatenablog.hatenaId, hatenablog.blogId, hatenablog.apiKey を設定してください'
    );
  });

  test('postMarkdownDocument: front matter がない場合は本文見出しをタイトルとして投稿する', async () => {
    const client = new RecordingClient({
      id: '1',
      title: 'Test',
      published: '2026-03-11T23:47:27+09:00',
      updated: '2026-03-11T23:47:27+09:00',
      categories: ['ubuntu'],
      draft: false,
      url: 'https://thr3a.hatenablog.com/entry/2026/03/11/234727'
    });

    const result = await postMarkdownDocument(
      {
        languageId: 'markdown',
        fullText: '# Test\nbody',
        config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' }
      },
      {
        client,
        now: () => new Date('2026-03-11T00:00:00.000Z')
      }
    );

    assert.strictEqual(client.requests.length, 1);
    assert.strictEqual(client.requests[0].title, 'Test');
    assert.deepStrictEqual(client.requests[0].categories, []);
    assert.strictEqual(client.requests[0].draft, false);
    assert.deepStrictEqual(result, {
      status: 'success',
      action: '投稿',
      title: 'Test',
      url: 'https://thr3a.hatenablog.com/entry/2026/03/11/234727',
      newContent: `---
id: 1
title: "Test"
date: "2026-03-11"
categories: ["ubuntu"]
published_at: "2026-03-11T23:47:27+09:00"
updated_at: "2026-03-11T23:47:27+09:00"
draft_flag: false
---
# Test
body`
    });
  });

  test('postMarkdownDocument: front matter の title/categories/draft_flag/updated_at を API に反映する', async () => {
    const client = new RecordingClient({
      id: '17179246901363868670',
      title: 'Posted Title',
      published: '2026-03-11T23:47:27+09:00',
      updated: '2026-03-11T23:48:27+09:00',
      categories: ['ubuntu', 'linux'],
      draft: false,
      url: 'https://thr3a.hatenablog.com/entry/2026/03/11/234827'
    });

    const result = await postMarkdownDocument(
      {
        languageId: 'markdown',
        fullText: `---
title: "Front Matter Title"
date: "2026-03-11"
categories: ["ubuntu", "linux"]
updated_at: "2026-03-11T23:40:00+09:00"
draft_flag: true
---
# Posted Title
body`,
        config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' }
      },
      {
        client,
        now: () => new Date('2026-03-11T00:00:00.000Z')
      }
    );

    assert.strictEqual(client.requests.length, 1);
    assert.strictEqual(client.requests[0].entryId, undefined);
    assert.strictEqual(client.requests[0].title, 'Front Matter Title');
    assert.deepStrictEqual(client.requests[0].categories, ['ubuntu', 'linux']);
    assert.strictEqual(client.requests[0].updatedAt, '2026-03-11T23:40:00+09:00');
    assert.strictEqual(client.requests[0].draft, true);
    assert.deepStrictEqual(result, {
      status: 'success',
      action: '投稿',
      title: 'Posted Title',
      url: 'https://thr3a.hatenablog.com/entry/2026/03/11/234827',
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
body`
    });
  });

  test('postMarkdownDocument: 既存のMarkdownをPUT形式で更新する', async () => {
    const client = new RecordingClient({
      id: '17179246901363868670',
      title: '',
      published: '',
      updated: '2026-03-12T00:00:00+09:00',
      categories: [],
      draft: false,
      url: 'https://thr3a.hatenablog.com/entry/2026/03/12/000000'
    });

    const result = await postMarkdownDocument(
      {
        languageId: 'markdown',
        fullText: `---
id: 17179246901363868670
title: "New Title"
date: "2026-03-11"
categories: ["refactor"]
published_at: "2026-03-11T23:47:27+09:00"
updated_at: "2026-03-11T12:00:00+09:00"
draft_flag: true
---
# New Title
body`,
        config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' }
      },
      {
        client,
        now: () => new Date('2026-03-11T15:00:00.000Z')
      }
    );

    assert.strictEqual(client.requests.length, 1);
    assert.strictEqual(client.requests[0].entryId, '17179246901363868670');
    assert.deepStrictEqual(client.requests[0].categories, ['refactor']);
    assert.strictEqual(client.requests[0].updatedAt, undefined);
    assert.strictEqual(client.requests[0].draft, true);
    assert.deepStrictEqual(result, {
      status: 'success',
      action: '更新',
      title: 'New Title',
      url: 'https://thr3a.hatenablog.com/entry/2026/03/12/000000',
      newContent: `---
id: 17179246901363868670
title: "New Title"
date: "2026-03-11"
categories: ["refactor"]
published_at: "2026-03-11T23:47:27+09:00"
updated_at: "2026-03-12T00:00:00+09:00"
draft_flag: false
---
# New Title
body`
    });
  });

  test('postMarkdownDocument: entry.titleが空の場合はフロントマターのタイトルを使用する', async () => {
    const client = new RecordingClient({
      id: '999',
      title: '',
      published: '2026-03-14T10:00:00+09:00',
      updated: '2026-03-14T10:00:00+09:00',
      categories: [],
      draft: false,
      url: 'https://example.com/entry'
    });

    const result = await postMarkdownDocument(
      {
        languageId: 'markdown',
        fullText: `---
title: "My Title"
---
# My Title
body`,
        config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' }
      },
      { client, now: () => new Date('2026-03-14T01:00:00.000Z') }
    );

    assert.strictEqual(result.status, 'success');
    if (result.status === 'success') {
      assert.strictEqual(result.title, 'My Title');
    }
  });

  test('buildUpdatedMarkdown: publishedが空の場合はnowの日付をdateとして使用する', () => {
    const result = buildUpdatedMarkdown({
      entry: {
        id: '1',
        title: 'Title',
        published: '',
        updated: '',
        categories: [],
        draft: false,
        url: ''
      },
      metadata: { title: 'Title', categories: [], draft_flag: false },
      body: '# Title\nbody',
      now: new Date('2026-03-14T01:00:00.000Z')
    });

    assert.match(result, /^date: "2026-03-14"$/m);
  });

  test('postMarkdownDocument: クライアントエラーをユーザー向けメッセージとして返す', async () => {
    const result = await postMarkdownDocument(
      {
        languageId: 'markdown',
        fullText: '# Test\nbody',
        config: { hatenaId: 'thr3a', blogId: 'thr3a.hatenablog.com', apiKey: 'secret' }
      },
      {
        client: {
          async submitEntry() {
            throw new Error('network down');
          }
        },
        now: () => new Date('2026-03-11T00:00:00.000Z')
      }
    );

    assert.deepStrictEqual(result, { status: 'error', message: 'network down' });
  });
});
