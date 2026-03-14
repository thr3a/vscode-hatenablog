import * as assert from 'node:assert';

import { buildApiRequest, createHatenaClient, HatenaApiError } from '#lib/client';

const MOCK_ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom"
       xmlns:app="http://www.w3.org/2007/app">
  <id>tag:blog.hatena.ne.jp,2013:blog-thr3a-20260311234727-17179246901363868670</id>
  <link rel="edit" href="https://blog.hatena.ne.jp/thr3a/thr3a.hatenablog.com/atom/entry/17179246901363868670"/>
  <link rel="alternate" type="text/html" href="https://thr3a.hatenablog.com/entry/2026/03/11/234727"/>
  <title>Test Title</title>
  <content type="text/x-markdown"># Test Title</content>
  <published>2026-03-11T23:47:27+09:00</published>
  <updated>2026-03-11T23:47:27+09:00</updated>
  <category term="ubuntu" />
  <app:control>
    <app:draft>no</app:draft>
  </app:control>
</entry>`;

function makeMockFetch(options: { ok: boolean; status: number; statusText: string; body: string }) {
  return async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    return {
      ok: options.ok,
      status: options.status,
      statusText: options.statusText,
      text: async () => options.body
    } as Response;
  };
}

function makeRecordingFetch(options: { ok: boolean; status: number; statusText: string; body: string }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: url.toString(), init: init ?? {} });
    return {
      ok: options.ok,
      status: options.status,
      statusText: options.statusText,
      text: async () => options.body
    } as Response;
  };
  return { fetch, calls };
}

suite('Hatena APIクライアント', () => {
  const baseRequest = {
    hatenaId: 'thr3a',
    blogId: 'thr3a.hatenablog.com',
    apiKey: 'secret',
    title: 'Test Title',
    content: '# body',
    categories: []
  };

  test('buildApiRequest: entryIdなしの場合はPOSTメソッドと新規投稿URLを返す', () => {
    const req = buildApiRequest(baseRequest);

    assert.strictEqual(req.method, 'POST');
    assert.strictEqual(req.url, 'https://blog.hatena.ne.jp/thr3a/thr3a.hatenablog.com/atom/entry');
  });

  test('buildApiRequest: entryIdありの場合はPUTメソッドとエントリURLを返す', () => {
    const req = buildApiRequest({ ...baseRequest, entryId: '17179246901363868670' });

    assert.strictEqual(req.method, 'PUT');
    assert.strictEqual(req.url, 'https://blog.hatena.ne.jp/thr3a/thr3a.hatenablog.com/atom/entry/17179246901363868670');
  });

  test('buildApiRequest: Content-TypeはXMLでAuthorizationはBasic認証ヘッダーを返す', () => {
    const req = buildApiRequest(baseRequest);

    assert.strictEqual(req.headers['Content-Type'], 'application/xml');
    const expectedToken = Buffer.from('thr3a:secret').toString('base64');
    assert.strictEqual(req.headers.Authorization, `Basic ${expectedToken}`);
  });

  test('buildApiRequest: ボディにはエントリのXMLが含まれる', () => {
    const req = buildApiRequest({ ...baseRequest, title: 'Hello & World', draft: true });

    assert.match(req.body, /<title>Hello &amp; World<\/title>/);
    assert.match(req.body, /<app:draft>yes<\/app:draft>/);
  });
});

suite('createHatenaClient', () => {
  const baseRequest = {
    hatenaId: 'thr3a',
    blogId: 'thr3a.hatenablog.com',
    apiKey: 'secret',
    title: 'Test Title',
    content: '# Test Title\nbody',
    categories: ['ubuntu']
  };

  test('成功: POSTレスポンスをAtomEntryとして返す', async () => {
    const client = createHatenaClient(
      makeMockFetch({ ok: true, status: 201, statusText: 'Created', body: MOCK_ATOM_XML })
    );

    const entry = await client.submitEntry(baseRequest);

    assert.strictEqual(entry.id, '17179246901363868670');
    assert.strictEqual(entry.title, 'Test Title');
    assert.strictEqual(entry.published, '2026-03-11T23:47:27+09:00');
    assert.strictEqual(entry.updated, '2026-03-11T23:47:27+09:00');
    assert.deepStrictEqual(entry.categories, ['ubuntu']);
    assert.strictEqual(entry.draft, false);
    assert.strictEqual(entry.url, 'https://thr3a.hatenablog.com/entry/2026/03/11/234727');
  });

  test('成功: entryIdありのリクエストでPUTが呼ばれる', async () => {
    const { fetch, calls } = makeRecordingFetch({ ok: true, status: 200, statusText: 'OK', body: MOCK_ATOM_XML });
    const client = createHatenaClient(fetch);

    await client.submitEntry({ ...baseRequest, entryId: '17179246901363868670' });

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].init.method, 'PUT');
    assert.match(calls[0].url, /\/entry\/17179246901363868670$/);
  });

  test('エラー: 401 UnauthorizedでHatenaApiErrorをスロー', async () => {
    const client = createHatenaClient(
      makeMockFetch({ ok: false, status: 401, statusText: 'Unauthorized', body: 'Unauthorized' })
    );

    await assert.rejects(
      () => client.submitEntry(baseRequest),
      (err: unknown) => {
        assert.ok(err instanceof HatenaApiError);
        assert.strictEqual(err.status, 401);
        assert.strictEqual(err.statusText, 'Unauthorized');
        return true;
      }
    );
  });

  test('エラー: 400 Bad RequestでエラーボディがHatenaApiError.bodyに含まれる', async () => {
    const errorBody = '<error><message>Invalid entry</message></error>';
    const client = createHatenaClient(
      makeMockFetch({ ok: false, status: 400, statusText: 'Bad Request', body: errorBody })
    );

    await assert.rejects(
      () => client.submitEntry(baseRequest),
      (err: unknown) => {
        assert.ok(err instanceof HatenaApiError);
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.body, errorBody);
        return true;
      }
    );
  });

  test('fetchに渡されるURL・メソッド・Authorizationヘッダーを検証する', async () => {
    const { fetch, calls } = makeRecordingFetch({ ok: true, status: 201, statusText: 'Created', body: MOCK_ATOM_XML });
    const client = createHatenaClient(fetch);

    await client.submitEntry(baseRequest);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, 'https://blog.hatena.ne.jp/thr3a/thr3a.hatenablog.com/atom/entry');
    assert.strictEqual(calls[0].init.method, 'POST');
    const headers = calls[0].init.headers as Record<string, string>;
    const expectedToken = Buffer.from('thr3a:secret').toString('base64');
    assert.strictEqual(headers.Authorization, `Basic ${expectedToken}`);
    assert.strictEqual(headers['Content-Type'], 'application/xml');
  });
});
