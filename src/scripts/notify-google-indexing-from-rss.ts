/**
 * はてなブログのRSSフィードを取得し、記事ごとのURLをGoogle Indexing APIへ一括送信するスクリプト。
 *
 * 実行方法:
 *   node --import tsx src/scripts/notify-google-indexing-from-rss.ts <サービスアカウントJSONの絶対パス>
 */
import { publishUrlToGoogleIndexingApi } from '#lib/google-indexing';

const RSS_URL = 'https://blog.turai.work/rss';
const SLEEP_MS = 10;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const extractEntryUrls = (rssXml: string): string[] => {
  const itemBlocks = rssXml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  const urls = itemBlocks.map((itemBlock) => {
    const linkMatch = itemBlock.match(/<link>([\s\S]*?)<\/link>/);
    if (linkMatch === null) {
      throw new Error(`RSSのitem内に<link>が見つかりませんでした: ${itemBlock}`);
    }
    const rawUrl = linkMatch[1].trim();
    return rawUrl.split('?')[0];
  });

  return urls;
};

const main = async (): Promise<void> => {
  const credentialsPath = process.argv[2];
  if (credentialsPath === undefined || credentialsPath.trim() === '') {
    console.error(
      '使い方: node --import tsx src/scripts/notify-google-indexing-from-rss.ts <サービスアカウントJSONの絶対パス>'
    );
    process.exitCode = 1;
    return;
  }

  const response = await fetch(RSS_URL);
  if (!response.ok) {
    throw new Error(`RSSの取得に失敗しました: ${response.status} ${response.statusText}`);
  }
  const rssXml = await response.text();

  const urls = extractEntryUrls(rssXml);
  console.log(`${urls.length}件のURLをGoogle Indexing APIへ送信します`);

  for (const url of urls) {
    console.log(`送信中: ${url}`);
    await publishUrlToGoogleIndexingApi({ credentialsPath, url });
    await sleep(SLEEP_MS);
  }

  console.log('すべてのURLの送信が完了しました');
};

main().catch((error: unknown) => {
  console.error('処理中にエラーが発生しました', error);
  process.exitCode = 1;
});
