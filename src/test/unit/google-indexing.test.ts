import * as assert from 'node:assert';

import { notifyGoogleIndexingIfConfigured, publishUrlToGoogleIndexingApi } from '#lib/google-indexing';

suite('Google Indexing API', () => {
  test('publishUrlToGoogleIndexingApi: 設定された認証情報で公開URLを送信する', async () => {
    const requests: Array<{
      input: unknown;
      init?: RequestInit;
    }> = [];
    const jwtParams: Array<{
      email: string;
      key: string;
      scopes: string[];
    }> = [];

    await publishUrlToGoogleIndexingApi(
      {
        credentialsPath: '/tmp/google-service-account.json',
        url: 'https://example.com/entry/2026/03/14/000000'
      },
      {
        readFile: async () =>
          JSON.stringify({
            client_email: 'indexer@example.iam.gserviceaccount.com',
            private_key: 'private-key'
          }),
        isAbsolutePath: () => true,
        createJwtClient: (params) => {
          jwtParams.push(params);
          return {
            authorize: async () => ({
              access_token: 'access-token'
            })
          };
        },
        fetchImpl: async (input, init) => {
          requests.push({ input, init });
          return new Response('', { status: 200 });
        }
      }
    );

    assert.deepStrictEqual(jwtParams, [
      {
        email: 'indexer@example.iam.gserviceaccount.com',
        key: 'private-key',
        scopes: ['https://www.googleapis.com/auth/indexing']
      }
    ]);
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0]?.input, 'https://indexing.googleapis.com/v3/urlNotifications:publish');
    assert.deepStrictEqual(requests[0]?.init?.method, 'POST');
    assert.deepStrictEqual(requests[0]?.init?.headers, {
      'Content-Type': 'application/json',
      Authorization: 'Bearer access-token'
    });
    assert.deepStrictEqual(
      requests[0]?.init?.body,
      JSON.stringify({
        url: 'https://example.com/entry/2026/03/14/000000',
        type: 'URL_UPDATED'
      })
    );
  });

  test('publishUrlToGoogleIndexingApi: 絶対パスでない設定値は無視する', async () => {
    let readFileCalled = false;

    await publishUrlToGoogleIndexingApi(
      {
        credentialsPath: './relative/path.json',
        url: 'https://example.com/entry/2026/03/14/000000'
      },
      {
        readFile: async () => {
          readFileCalled = true;
          return '';
        },
        isAbsolutePath: () => false,
        createJwtClient: () => ({
          authorize: async () => ({
            access_token: 'access-token'
          })
        }),
        fetchImpl: async () => new Response('', { status: 200 })
      }
    );

    assert.strictEqual(readFileCalled, false);
  });

  test('notifyGoogleIndexingIfConfigured: 設定がなければ何もしない', async () => {
    let publishCalled = false;
    let logCalled = false;

    await notifyGoogleIndexingIfConfigured(
      {
        credentialsPath: '',
        url: 'https://example.com/entry/2026/03/14/000000'
      },
      {
        publishUrl: async () => {
          publishCalled = true;
        },
        logError: () => {
          logCalled = true;
        }
      }
    );

    assert.strictEqual(publishCalled, false);
    assert.strictEqual(logCalled, false);
  });

  test('notifyGoogleIndexingIfConfigured: API送信に失敗しても例外を投げない', async () => {
    const logMessages: string[] = [];

    await notifyGoogleIndexingIfConfigured(
      {
        credentialsPath: '/tmp/google-service-account.json',
        url: 'https://example.com/entry/2026/03/14/000000'
      },
      {
        publishUrl: async () => {
          throw new Error('request failed');
        },
        logError: (message) => {
          logMessages.push(message);
        }
      }
    );

    assert.deepStrictEqual(logMessages, ['Google Indexing API への送信に失敗しました']);
  });
});
