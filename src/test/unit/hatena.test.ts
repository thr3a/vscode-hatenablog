import * as assert from 'node:assert';

import {
  buildEntryXml,
  buildFrontMatter,
  escapeXml,
  extractTitle,
  parseFrontMatter,
  parseResponseXml
} from '#lib/hatena';

suite('hatenaヘルパー', () => {
  test('parseFrontMatter: メタデータを読み取り本文と分離する', () => {
    const text = `---
id: 17179246901363868670
title: "test"
date: "2026-03-11"
categories: ["ubuntu", "linux"]
published_at: "2026-03-11T23:47:27+09:00"
updated_at: "2026-03-11T23:47:27+09:00"
draft_flag: false
---
# body
content`;

    const parsed = parseFrontMatter(text);

    assert.deepStrictEqual(parsed.frontMatter, {
      id: '17179246901363868670',
      title: 'test',
      date: '2026-03-11',
      categories: ['ubuntu', 'linux'],
      published_at: '2026-03-11T23:47:27+09:00',
      updated_at: '2026-03-11T23:47:27+09:00',
      draft_flag: false
    });
    assert.strictEqual(parsed.body, '# body\ncontent');
  });

  test('parseFrontMatter: メタデータが存在しない場合は本文をそのまま返す', () => {
    const body = '# title\ncontent';
    assert.deepStrictEqual(parseFrontMatter(body), { frontMatter: null, body });
  });

  test('buildFrontMatter: カテゴリリストのフォーマットを正しく出力する', () => {
    const built = buildFrontMatter({
      id: '123',
      title: 'hello',
      date: '2026-03-11',
      categories: ['ubuntu', 'linux'],
      published_at: '2026-03-11T23:47:27+09:00',
      updated_at: '2026-03-11T23:47:27+09:30',
      draft_flag: false
    });

    assert.match(built, /^---$/m);
    assert.match(built, /^categories: \["ubuntu", "linux"\]$/m);
    assert.match(built, /^draft_flag: false$/m);
  });

  test('extractTitle: 最初のMarkdown見出しをタイトルとして読み取る', () => {
    assert.strictEqual(extractTitle('intro\n# Actual Title\nbody'), 'Actual Title');
    assert.strictEqual(extractTitle('plain body'), 'Untitled');
  });

  test('escapeXml: すべての予約文字をエスケープする', () => {
    assert.strictEqual(escapeXml(`a&b<c>d"e'f`), 'a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });

  test('buildEntryXml: カテゴリとエスケープ済みMarkdown内容を含むXMLを生成する', () => {
    const xml = buildEntryXml({
      title: 'Hello & World',
      content: '# body <tag>',
      categories: ['ubuntu', ''],
      updatedAt: '2026-03-11T23:47:27+09:00',
      draft: true
    });

    assert.match(xml, /<title>Hello &amp; World<\/title>/);
    assert.match(xml, /<content type="text\/x-markdown"># body &lt;tag&gt;<\/content>/);
    assert.match(xml, /<updated>2026-03-11T23:47:27\+09:00<\/updated>/);
    assert.match(xml, /<category term="ubuntu" \/>/);
    assert.doesNotMatch(xml, /<category term="" \/>/);
    assert.match(xml, /<app:draft>yes<\/app:draft>/);
  });

  test('parseResponseXml: editリンクからエントリIDを優先的に取得する', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app">
  <id>tag:blog.hatena.ne.jp,2026:blog-12345678901234567890-10257846132639628337</id>
  <title>posted title</title>
  <published>2026-03-11T23:47:27+09:00</published>
  <updated>2026-03-11T23:48:27+09:00</updated>
  <category term="ubuntu" />
  <category term="linux" />
  <link rel="edit" href="https://blog.hatena.ne.jp/thr3a/thr3a.hatenablog.com/atom/entry/17179246901363868670"/>
  <app:control>
    <app:draft>no</app:draft>
  </app:control>
</entry>`;

    assert.deepStrictEqual(parseResponseXml(xml), {
      id: '17179246901363868670',
      title: 'posted title',
      published: '2026-03-11T23:47:27+09:00',
      updated: '2026-03-11T23:48:27+09:00',
      categories: ['ubuntu', 'linux'],
      draft: false
    });
  });
});
