import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';

type GoogleServiceAccountKey = {
  client_email: string;
  private_key: string;
};

type GoogleJwtClient = {
  authorize(): Promise<{
    access_token?: string | null;
  }>;
};

type GoogleIndexingDeps = {
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
  isAbsolutePath: (targetPath: string) => boolean;
  createJwtClient: (params: { email: string; key: string; scopes: string[] }) => GoogleJwtClient;
  fetchImpl: typeof fetch;
};

type PublishUrlInput = {
  credentialsPath: string;
  url: string;
};

type NotifyIndexingInput = PublishUrlInput;

type NotifyIndexingDeps = {
  publishUrl: (input: PublishUrlInput) => Promise<void>;
  logError: (message: string, error: unknown) => void;
};

const GOOGLE_INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const GOOGLE_INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

const createDefaultJwtClient = (params: { email: string; key: string; scopes: string[] }): GoogleJwtClient =>
  new google.auth.JWT({
    email: params.email,
    key: params.key,
    scopes: params.scopes
  });

const defaultGoogleIndexingDeps: GoogleIndexingDeps = {
  readFile: fs.readFile,
  isAbsolutePath: path.isAbsolute,
  createJwtClient: createDefaultJwtClient,
  fetchImpl: fetch
};

const defaultNotifyIndexingDeps: NotifyIndexingDeps = {
  publishUrl: (input) => publishUrlToGoogleIndexingApi(input),
  logError: (message, error) => {
    console.error(message, error);
  }
};

const isGoogleServiceAccountKey = (value: unknown): value is GoogleServiceAccountKey => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const clientEmail = Reflect.get(value, 'client_email');
  const privateKey = Reflect.get(value, 'private_key');

  return typeof clientEmail === 'string' && typeof privateKey === 'string';
};

const loadServiceAccountKey = async (
  credentialsPath: string,
  deps: GoogleIndexingDeps
): Promise<GoogleServiceAccountKey> => {
  const rawJson = await deps.readFile(credentialsPath, 'utf8');
  const parsed: unknown = JSON.parse(rawJson);

  if (!isGoogleServiceAccountKey(parsed)) {
    throw new Error('Google認証情報JSONの形式が不正です');
  }

  return parsed;
};

export const publishUrlToGoogleIndexingApi = async (
  input: PublishUrlInput,
  deps: GoogleIndexingDeps = defaultGoogleIndexingDeps
): Promise<void> => {
  const credentialsPath = input.credentialsPath.trim();
  const url = input.url.trim();

  if (!credentialsPath || !url) {
    return;
  }

  if (!deps.isAbsolutePath(credentialsPath)) {
    return;
  }

  const key = await loadServiceAccountKey(credentialsPath, deps);
  const jwtClient = deps.createJwtClient({
    email: key.client_email,
    key: key.private_key,
    scopes: [GOOGLE_INDEXING_SCOPE]
  });
  const tokens = await jwtClient.authorize();

  if (typeof tokens.access_token !== 'string' || tokens.access_token.length === 0) {
    throw new Error('Google Indexing API 用のアクセストークン取得に失敗しました');
  }

  const response = await deps.fetchImpl(GOOGLE_INDEXING_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.access_token}`
    },
    body: JSON.stringify({
      url,
      type: 'URL_UPDATED'
    })
  });

  if (response.ok) {
    return;
  }

  throw new Error(
    `Google Indexing API へのリクエストに失敗しました: ${response.status} ${response.statusText}\n${await response.text()}`
  );
};

export const notifyGoogleIndexingIfConfigured = async (
  input: NotifyIndexingInput,
  deps: NotifyIndexingDeps = defaultNotifyIndexingDeps
): Promise<void> => {
  const credentialsPath = input.credentialsPath.trim();
  const url = input.url.trim();

  if (!credentialsPath || !url) {
    return;
  }

  try {
    await deps.publishUrl({
      credentialsPath,
      url
    });
  } catch (error: unknown) {
    deps.logError('Google Indexing API への送信に失敗しました', error);
  }
};
