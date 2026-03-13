import { type AtomEntry, buildEntryXml, parseResponseXml } from '#lib/hatena';

export interface SubmitEntryRequest {
  hatenaId: string;
  blogId: string;
  apiKey: string;
  title: string;
  content: string;
  categories: string[];
  updatedAt?: string;
  draft?: boolean;
  entryId?: string;
}

export interface HatenaClient {
  submitEntry(request: SubmitEntryRequest): Promise<AtomEntry>;
}

export class HatenaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string
  ) {
    super(`投稿に失敗しました: ${status} ${statusText}\n${body}`);
    this.name = 'HatenaApiError';
  }
}

export function buildApiRequest(request: SubmitEntryRequest): {
  url: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  body: string;
} {
  const method = request.entryId ? 'PUT' : 'POST';
  const url = request.entryId
    ? `https://blog.hatena.ne.jp/${request.hatenaId}/${request.blogId}/atom/entry/${request.entryId}`
    : `https://blog.hatena.ne.jp/${request.hatenaId}/${request.blogId}/atom/entry`;

  return {
    url,
    method,
    headers: {
      'Content-Type': 'application/xml',
      Authorization: `Basic ${Buffer.from(`${request.hatenaId}:${request.apiKey}`).toString('base64')}`
    },
    body: buildEntryXml({
      title: request.title,
      content: request.content,
      categories: request.categories,
      updatedAt: request.updatedAt,
      draft: request.draft
    })
  };
}

export function createHatenaClient(fetchImpl: typeof fetch): HatenaClient {
  return {
    async submitEntry(request: SubmitEntryRequest): Promise<AtomEntry> {
      const apiRequest = buildApiRequest(request);
      const response = await fetchImpl(apiRequest.url, {
        method: apiRequest.method,
        headers: apiRequest.headers,
        body: apiRequest.body
      });

      if (!response.ok) {
        throw new HatenaApiError(response.status, response.statusText, await response.text());
      }

      return parseResponseXml(await response.text());
    }
  };
}
