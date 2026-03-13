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

  test('publishUrlToGoogleIndexingApi: URLが空の場合は何もしない', async () => {
    let readFileCalled = false;

    await publishUrlToGoogleIndexingApi(
      { credentialsPath: '/tmp/creds.json', url: '' },
      {
        readFile: async () => {
          readFileCalled = true;
          return '';
        },
        isAbsolutePath: () => true,
        createJwtClient: () => ({ authorize: async () => ({ access_token: 'token' }) }),
        fetchImpl: async () => new Response('', { status: 200 })
      }
    );

    assert.strictEqual(readFileCalled, false);
  });

  test('publishUrlToGoogleIndexingApi: 認証情報JSONが不正な場合はエラーをスローする', async () => {
    await assert.rejects(
      () =>
        publishUrlToGoogleIndexingApi(
          { credentialsPath: '/tmp/creds.json', url: 'https://example.com/' },
          {
            readFile: async () => JSON.stringify({ not_client_email: 'x' }),
            isAbsolutePath: () => true,
            createJwtClient: () => ({ authorize: async () => ({ access_token: 'token' }) }),
            fetchImpl: async () => new Response('', { status: 200 })
          }
        ),
      /Google認証情報JSONの形式が不正です/
    );
  });

  test('publishUrlToGoogleIndexingApi: アクセストークン取得失敗時はエラーをスローする', async () => {
    await assert.rejects(
      () =>
        publishUrlToGoogleIndexingApi(
          { credentialsPath: '/tmp/creds.json', url: 'https://example.com/' },
          {
            readFile: async () => JSON.stringify({ client_email: 'a@b.com', private_key: 'key' }),
            isAbsolutePath: () => true,
            createJwtClient: () => ({ authorize: async () => ({ access_token: null }) }),
            fetchImpl: async () => new Response('', { status: 200 })
          }
        ),
      /アクセストークン取得に失敗しました/
    );
  });

  test('publishUrlToGoogleIndexingApi: APIが200以外を返した場合はエラーをスローする', async () => {
    await assert.rejects(
      () =>
        publishUrlToGoogleIndexingApi(
          { credentialsPath: '/tmp/creds.json', url: 'https://example.com/' },
          {
            readFile: async () => JSON.stringify({ client_email: 'a@b.com', private_key: 'key' }),
            isAbsolutePath: () => true,
            createJwtClient: () => ({ authorize: async () => ({ access_token: 'token' }) }),
            fetchImpl: async () => new Response('Forbidden', { status: 403 })
          }
        ),
      /403/
    );
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
