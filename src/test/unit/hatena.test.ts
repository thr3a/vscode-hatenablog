import * as assert from 'assert';

import {
	buildEntryXml,
	buildFrontMatter,
	escapeXml,
	extractTitle,
	parseFrontMatter,
	parseResponseXml,
} from '../../lib/hatena';

suite('hatena helpers', () => {
	test('parseFrontMatter reads metadata and separates body', () => {
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
			draft_flag: false,
		});
		assert.strictEqual(parsed.body, '# body\ncontent');
	});

	test('parseFrontMatter returns plain body when metadata does not exist', () => {
		const body = '# title\ncontent';
		assert.deepStrictEqual(parseFrontMatter(body), { frontMatter: null, body });
	});

	test('buildFrontMatter preserves category list formatting', () => {
		const built = buildFrontMatter({
			id: '123',
			title: 'hello',
			date: '2026-03-11',
			categories: ['ubuntu', 'linux'],
			published_at: '2026-03-11T23:47:27+09:00',
			updated_at: '2026-03-11T23:47:27+09:30',
			draft_flag: false,
		});

		assert.match(built, /^---$/m);
		assert.match(built, /^categories: \["ubuntu", "linux"\]$/m);
		assert.match(built, /^draft_flag: false$/m);
	});

	test('extractTitle reads the first markdown heading', () => {
		assert.strictEqual(extractTitle('intro\n# Actual Title\nbody'), 'Actual Title');
		assert.strictEqual(extractTitle('plain body'), 'Untitled');
	});

	test('escapeXml escapes all reserved characters', () => {
		assert.strictEqual(
			escapeXml(`a&b<c>d"e'f`),
			'a&amp;b&lt;c&gt;d&quot;e&apos;f',
		);
	});

	test('buildEntryXml includes categories and escaped markdown content', () => {
		const xml = buildEntryXml('Hello & World', '# body <tag>', ['ubuntu', '']);

		assert.match(xml, /<title>Hello &amp; World<\/title>/);
		assert.match(xml, /<content type="text\/x-markdown"># body &lt;tag&gt;<\/content>/);
		assert.match(xml, /<category term="ubuntu" \/>/);
		assert.doesNotMatch(xml, /<category term="" \/>/);
	});

	test('parseResponseXml prefers edit link entry id', () => {
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
			draft: false,
		});
	});
});
