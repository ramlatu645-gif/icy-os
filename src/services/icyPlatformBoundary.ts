/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IcyPlatformConnectionStatus,
  IcyServiceStatusRecord,
} from '../types/launcher';
import {
  loadServiceStatusRecord,
  saveServiceStatusRecord,
} from '../storage/serviceStatusStorage';

export type HttpFetcher = (
  input: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

const defaultFetcher: HttpFetcher = async (input, init) => {
  const response = await fetch(input, init);
  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json(),
  };
};

/**
 * ICY Private Platform API Client Service.
 *
 * Interacts ONLY with the trusted server-side proxy routes (`/api/icy-platform/*`).
 * - Never stores privileged ICY application API keys in frontend state, VITE_ env vars,
 *   or browser localStorage.
 * - Never exposes or asks for an internal service URL in the frontend UI.
 * - Never reports 'connected' unless a real backend verification request succeeds.
 */
export class IcyPlatformClientService {
  private fetcher: HttpFetcher;

  constructor(fetcher: HttpFetcher = defaultFetcher) {
    this.fetcher = fetcher;
  }

  public getCachedStatus(): IcyServiceStatusRecord {
    return loadServiceStatusRecord();
  }

  public async refreshStatus(): Promise<IcyServiceStatusRecord> {
    try {
      const res = await this.fetcher('/api/icy-platform/status', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const data = (await res.json()) as Record<string, unknown>;
      return saveServiceStatusRecord({
        version: 1,
        status: (data.status as IcyPlatformConnectionStatus) || 'service-unavailable',
        hasKeyConfigured: Boolean(data.hasKeyConfigured),
        keyHint: typeof data.keyHint === 'string' ? data.keyHint : null,
        hasBackendBaseUrlConfigured: Boolean(data.hasBackendBaseUrlConfigured),
        lastVerifiedAt:
          typeof data.lastVerifiedAt === 'string' ? data.lastVerifiedAt : null,
        errorDetail:
          typeof data.errorDetail === 'string' ? data.errorDetail : null,
      });
    } catch (err) {
      return saveServiceStatusRecord({
        ...this.getCachedStatus(),
        status: 'service-unavailable',
        errorDetail: `Unable to reach local server proxy: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      });
    }
  }

  /**
   * Submits an ICY application API key securely to the server-side secret store.
   * Never saves the raw key in browser localStorage.
   */
  public async submitApplicationApiKey(
    apiKey: string
  ): Promise<{ accepted: boolean; record: IcyServiceStatusRecord }> {
    const trimmed = apiKey.trim();
    if (!trimmed || trimmed.length < 8) {
      const current = this.getCachedStatus();
      return {
        accepted: false,
        record: {
          ...current,
          errorDetail: 'Please enter a valid ICY application API key (at least 8 characters).',
        },
      };
    }

    try {
      const res = await this.fetcher('/api/icy-platform/key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ apiKey: trimmed }),
      });

      const data = (await res.json()) as Record<string, unknown>;
      const record = saveServiceStatusRecord({
        version: 1,
        status: (data.status as IcyPlatformConnectionStatus) || 'not-connected',
        hasKeyConfigured: Boolean(data.hasKeyConfigured),
        keyHint: typeof data.keyHint === 'string' ? data.keyHint : null,
        hasBackendBaseUrlConfigured: Boolean(data.hasBackendBaseUrlConfigured),
        lastVerifiedAt:
          typeof data.lastVerifiedAt === 'string' ? data.lastVerifiedAt : null,
        errorDetail:
          typeof data.errorDetail === 'string' ? data.errorDetail : null,
      });

      return {
        accepted: Boolean(data.accepted),
        record,
      };
    } catch (err) {
      const fallback = saveServiceStatusRecord({
        ...this.getCachedStatus(),
        status: 'service-unavailable',
        errorDetail: `Failed to submit key to backend: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      });
      return { accepted: false, record: fallback };
    }
  }

  /**
   * Requests a real connection verification against the configured Phase 1 ICY Platform API.
   * Only sets status to 'connected' if the real service responds with HTTP 200 OK.
   */
  public async verifyConnection(): Promise<IcyServiceStatusRecord> {
    try {
      const res = await this.fetcher('/api/icy-platform/verify', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });

      const data = (await res.json()) as Record<string, unknown>;
      return saveServiceStatusRecord({
        version: 1,
        status: (data.status as IcyPlatformConnectionStatus) || 'service-unavailable',
        hasKeyConfigured: Boolean(data.hasKeyConfigured),
        keyHint: typeof data.keyHint === 'string' ? data.keyHint : null,
        hasBackendBaseUrlConfigured: Boolean(data.hasBackendBaseUrlConfigured),
        lastVerifiedAt:
          typeof data.lastVerifiedAt === 'string' ? data.lastVerifiedAt : null,
        errorDetail:
          typeof data.errorDetail === 'string' ? data.errorDetail : null,
      });
    } catch (err) {
      return saveServiceStatusRecord({
        ...this.getCachedStatus(),
        status: 'service-unavailable',
        errorDetail: `Connection verification failed: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      });
    }
  }

  public async disconnectKey(): Promise<IcyServiceStatusRecord> {
    try {
      const res = await this.fetcher('/api/icy-platform/key', {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as Record<string, unknown>;
      return saveServiceStatusRecord({
        version: 1,
        status: (data.status as IcyPlatformConnectionStatus) || 'not-configured',
        hasKeyConfigured: false,
        keyHint: null,
        hasBackendBaseUrlConfigured: Boolean(data.hasBackendBaseUrlConfigured),
        lastVerifiedAt: null,
        errorDetail: null,
      });
    } catch {
      return saveServiceStatusRecord({
        version: 1,
        status: 'not-configured',
        hasKeyConfigured: false,
        keyHint: null,
        hasBackendBaseUrlConfigured: false,
        lastVerifiedAt: null,
        errorDetail: null,
      });
    }
  }

  /**
   * Calls the Phase 1 documented `GET /api/v1/health` endpoint via the trusted server proxy.
   */
  public async checkHealth(): Promise<{
    ok: boolean;
    status: IcyPlatformConnectionStatus;
    errorDetail: string | null;
  }> {
    try {
      const res = await this.fetcher('/api/v1/health', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as Record<string, unknown>;
      return {
        ok: Boolean(res.ok && data.ok === true),
        status: (data.status as IcyPlatformConnectionStatus) || 'service-unavailable',
        errorDetail: typeof data.errorDetail === 'string' ? data.errorDetail : null,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'service-unavailable',
        errorDetail: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  /**
   * Calls the Phase 1 documented `GET /api/v1/status` endpoint via the trusted server proxy.
   */
  public async getPlatformStatus(): Promise<{
    ok: boolean;
    status: IcyPlatformConnectionStatus;
    data?: unknown;
    errorDetail: string | null;
  }> {
    try {
      const res = await this.fetcher('/api/v1/status', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as Record<string, unknown>;
      return {
        ok: Boolean(res.ok && data.ok === true),
        status: (data.status as IcyPlatformConnectionStatus) || 'service-unavailable',
        data: data.data,
        errorDetail: typeof data.errorDetail === 'string' ? data.errorDetail : null,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'service-unavailable',
        errorDetail: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  /**
   * Calls the Phase 1 documented `GET /api/v1/me` endpoint via the trusted server proxy.
   */
  public async getAppIdentity(): Promise<{
    ok: boolean;
    status: IcyPlatformConnectionStatus;
    appIdentity?: unknown;
    errorDetail: string | null;
  }> {
    try {
      const res = await this.fetcher('/api/v1/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as Record<string, unknown>;
      return {
        ok: Boolean(res.ok && data.ok === true),
        status: (data.status as IcyPlatformConnectionStatus) || 'service-unavailable',
        appIdentity: data.appIdentity,
        errorDetail: typeof data.errorDetail === 'string' ? data.errorDetail : null,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'service-unavailable',
        errorDetail: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  /**
   * Calls the Phase 1 documented `POST /api/v1/search/query` endpoint via the trusted server proxy.
   */
  public async queryPlatformSearch(query: string): Promise<{
    ok: boolean;
    status: IcyPlatformConnectionStatus;
    results?: unknown;
    errorDetail: string | null;
  }> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        ok: false,
        status: 'not-connected',
        errorDetail: 'Search query is required.',
      };
    }
    try {
      const res = await this.fetcher('/api/v1/search/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      return {
        ok: Boolean(res.ok && data.ok === true),
        status: (data.status as IcyPlatformConnectionStatus) || 'service-unavailable',
        results: data.results,
        errorDetail: typeof data.errorDetail === 'string' ? data.errorDetail : null,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'service-unavailable',
        errorDetail: err instanceof Error ? err.message : 'Network error',
      };
    }
  }
}

export const icyPlatformClient = new IcyPlatformClientService();

