import * as assert from 'node:assert';

import { buildApiRequest } from '#lib/client';

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
