/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DelegatedAppToken,
  IcyAccountSessionRecord,
  RegisteredApplication,
} from '../types/launcher';
import { getAuthoritativeOfficialAppRegistry } from '../registry/officialIcyAppRegistry';

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

export const DEFAULT_ACCOUNT_SESSION: IcyAccountSessionRecord = {
  version: 1,
  status: 'not-connected',
  isAuthenticated: false,
  user: null,
  grantedScopes: [],
  sessionExpiresAt: null,
  lastVerifiedAt: null,
  errorDetail: null,
  hasBackendServiceConfigured: false,
  hasServiceKeyConfigured: false,
  serviceKeyHint: null,
};

const ACCOUNT_SESSION_CACHE_KEY = 'ic_app_launcher_account_session_v1';

/**
 * ICY Account Client Service.
 *
 * Implements the client-side boundary for ICY Account authorization and session management.
 * - Manages authorization-code flow with PKCE handoff.
 * - Interacts ONLY through the trusted server-side proxy routes (`/api/icy-account/*`).
 * - Never stores raw access tokens, refresh tokens, client secrets, or private service keys
 *   in browser localStorage or frontend variables.
 * - Reuses valid sessions across launcher restarts.
 * - Accurately represents the 7 required connection states:
 *   'not-connected', 'awaiting-authorization', 'authenticated', 'connected',
 *   'service-unavailable', 'session-expired', 'offline'.
 */
export class IcyAccountClientService {
  private fetcher: HttpFetcher;

  constructor(fetcher: HttpFetcher = defaultFetcher) {
    this.fetcher = fetcher;
  }

  public getCachedSession(): IcyAccountSessionRecord {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return { ...DEFAULT_ACCOUNT_SESSION };
      }
      const raw = window.localStorage.getItem(ACCOUNT_SESSION_CACHE_KEY);
      if (!raw) return { ...DEFAULT_ACCOUNT_SESSION };
      const parsed = JSON.parse(raw) as IcyAccountSessionRecord;
      return {
        ...DEFAULT_ACCOUNT_SESSION,
        ...parsed,
      };
    } catch {
      return { ...DEFAULT_ACCOUNT_SESSION };
    }
  }

  public saveCachedSession(record: IcyAccountSessionRecord): IcyAccountSessionRecord {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ACCOUNT_SESSION_CACHE_KEY, JSON.stringify(record));
      }
    } catch {
      // Ignore storage errors
    }
    return record;
  }

  /**
   * Refreshes and validates current session from the server.
   */
  public async getSession(): Promise<IcyAccountSessionRecord> {
    try {
      const res = await this.fetcher('/api/icy-account/session', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const data = (await res.json()) as Record<string, unknown>;
      const record: IcyAccountSessionRecord = {
        version: 1,
        status: (data.status as IcyAccountSessionRecord['status']) || 'not-connected',
        isAuthenticated: Boolean(data.isAuthenticated),
        user: (data.user as IcyAccountSessionRecord['user']) || null,
        grantedScopes: Array.isArray(data.grantedScopes)
          ? data.grantedScopes.filter((s): s is string => typeof s === 'string')
          : [],
        sessionExpiresAt:
          typeof data.sessionExpiresAt === 'string' ? data.sessionExpiresAt : null,
        lastVerifiedAt:
          typeof data.lastVerifiedAt === 'string' ? data.lastVerifiedAt : null,
        errorDetail:
          typeof data.errorDetail === 'string' ? data.errorDetail : null,
        hasBackendServiceConfigured: Boolean(data.hasBackendServiceConfigured),
        hasServiceKeyConfigured: Boolean(data.hasServiceKeyConfigured),
        serviceKeyHint:
          typeof data.serviceKeyHint === 'string' ? data.serviceKeyHint : null,
      };

      return this.saveCachedSession(record);
    } catch (err) {
      const cached = this.getCachedSession();
      const offlineRecord: IcyAccountSessionRecord = {
        ...cached,
        status: cached.isAuthenticated ? 'offline' : 'service-unavailable',
        errorDetail: `Unable to reach account proxy: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      };
      return this.saveCachedSession(offlineRecord);
    }
  }

  /**
   * Initiates the authorization-code with PKCE flow.
   * Generates PKCE parameters on server and returns the authorization URL.
   */
  public async startAccountAuthorization(): Promise<{
    success: boolean;
    authUrl?: string;
    state?: string;
    error?: string;
  }> {
    try {
      const res = await this.fetcher('/api/icy-account/oauth/start', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });

      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: typeof data.errorDetail === 'string' ? data.errorDetail : 'Failed to start authorization flow.',
        };
      }

      // Update cached status to 'awaiting-authorization'
      const cached = this.getCachedSession();
      this.saveCachedSession({
        ...cached,
        status: 'awaiting-authorization',
      });

      return {
        success: true,
        authUrl: typeof data.authUrl === 'string' ? data.authUrl : undefined,
        state: typeof data.state === 'string' ? data.state : undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: `Could not start account authorization: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      };
    }
  }

  /**
   * Completes the authorization flow after redirect / callback.
   * Server exchanges code and PKCE code_verifier for an authorized session.
   */
  public async completeAuthorization(
    code: string,
    state: string
  ): Promise<{ success: boolean; session: IcyAccountSessionRecord; error?: string }> {
    try {
      const res = await this.fetcher('/api/icy-account/oauth/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok || !data.success) {
        const failedRecord: IcyAccountSessionRecord = {
          ...this.getCachedSession(),
          status: 'service-unavailable',
          errorDetail: typeof data.errorDetail === 'string' ? data.errorDetail : 'Authorization exchange failed.',
        };
        return {
          success: false,
          session: this.saveCachedSession(failedRecord),
          error: failedRecord.errorDetail || undefined,
        };
      }

      const session = await this.getSession();
      return {
        success: true,
        session,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      return {
        success: false,
        session: this.getCachedSession(),
        error: `Authorization exchange failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Performs an authenticated verification operation against the upstream ICY Account service.
   * Reports 'connected' ONLY if an actual authenticated request succeeds.
   */
  public async verifyConnection(): Promise<IcyAccountSessionRecord> {
    try {
      const res = await this.fetcher('/api/icy-account/session/verify', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });

      const data = (await res.json()) as Record<string, unknown>;
      const record: IcyAccountSessionRecord = {
        version: 1,
        status: (data.status as IcyAccountSessionRecord['status']) || 'service-unavailable',
        isAuthenticated: Boolean(data.isAuthenticated),
        user: (data.user as IcyAccountSessionRecord['user']) || null,
        grantedScopes: Array.isArray(data.grantedScopes)
          ? data.grantedScopes.filter((s): s is string => typeof s === 'string')
          : [],
        sessionExpiresAt:
          typeof data.sessionExpiresAt === 'string' ? data.sessionExpiresAt : null,
        lastVerifiedAt:
          typeof data.lastVerifiedAt === 'string' ? data.lastVerifiedAt : null,
        errorDetail:
          typeof data.errorDetail === 'string' ? data.errorDetail : null,
        hasBackendServiceConfigured: Boolean(data.hasBackendServiceConfigured),
        hasServiceKeyConfigured: Boolean(data.hasServiceKeyConfigured),
        serviceKeyHint:
          typeof data.serviceKeyHint === 'string' ? data.serviceKeyHint : null,
      };

      return this.saveCachedSession(record);
    } catch (err) {
      const cached = this.getCachedSession();
      const offlineRecord: IcyAccountSessionRecord = {
        ...cached,
        status: 'service-unavailable',
        errorDetail: `Verification failed: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      };
      return this.saveCachedSession(offlineRecord);
    }
  }

  /**
   * Refreshes the session using the server-side refresh token.
   */
  public async refreshSession(): Promise<IcyAccountSessionRecord> {
    try {
      const res = await this.fetcher('/api/icy-account/session/refresh', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const expiredRecord: IcyAccountSessionRecord = {
          ...this.getCachedSession(),
          status: 'session-expired',
          isAuthenticated: false,
          errorDetail: typeof data.errorDetail === 'string' ? data.errorDetail : 'Session expired. Please sign in again.',
        };
        return this.saveCachedSession(expiredRecord);
      }
      return this.getSession();
    } catch (err) {
      return this.getCachedSession();
    }
  }

  /**
   * Signs out and revokes the authorized session.
   */
  public async signOut(): Promise<IcyAccountSessionRecord> {
    try {
      await this.fetcher('/api/icy-account/sign-out', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
    } catch {
      // Ignore network errors during sign-out
    }

    const cleared: IcyAccountSessionRecord = {
      ...DEFAULT_ACCOUNT_SESSION,
      hasBackendServiceConfigured: this.getCachedSession().hasBackendServiceConfigured,
      hasServiceKeyConfigured: this.getCachedSession().hasServiceKeyConfigured,
      serviceKeyHint: this.getCachedSession().serviceKeyHint,
    };
    return this.saveCachedSession(cleared);
  }

  /**
   * Submits the privileged ICY Account Core Service Key to the server.
   * Kept strictly in server memory, never stored in client local storage.
   */
  public async submitServiceKey(
    serviceKey: string
  ): Promise<{ accepted: boolean; session: IcyAccountSessionRecord; error?: string }> {
    const trimmed = serviceKey.trim();
    if (!trimmed || trimmed.length < 8) {
      return {
        accepted: false,
        session: this.getCachedSession(),
        error: 'Please enter a valid ICY Account Core Service key (at least 8 characters).',
      };
    }

    try {
      const res = await this.fetcher('/api/icy-account/service-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ serviceKey: trimmed }),
      });

      const data = (await res.json()) as Record<string, unknown>;
      const session = await this.getSession();
      return {
        accepted: Boolean(data.accepted),
        session,
        error: typeof data.errorDetail === 'string' ? data.errorDetail : undefined,
      };
    } catch (err) {
      return {
        accepted: false,
        session: this.getCachedSession(),
        error: `Failed to configure service key: ${err instanceof Error ? err.message : 'Network error'}`,
      };
    }
  }

  /**
   * Disconnects the server-side service key.
   */
  public async disconnectServiceKey(): Promise<IcyAccountSessionRecord> {
    try {
      await this.fetcher('/api/icy-account/service-key', {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
    } catch {
      // Ignore
    }
    return this.getSession();
  }

  /**
   * Loads official ICY application registrations from the authoritative registry.
   */
  public async loadOfficialAppRegistry(): Promise<RegisteredApplication[]> {
    try {
      const res = await this.fetcher('/api/icy-service-bus/registry', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        const data = (await res.json()) as { apps?: RegisteredApplication[] };
        if (Array.isArray(data.apps) && data.apps.length > 0) {
          return data.apps;
        }
      }
    } catch {
      // Fallback to local authoritative definition if proxy endpoint is momentarily unreachable
    }
    return getAuthoritativeOfficialAppRegistry();
  }

  /**
   * Requests a scoped delegated token for a specific official app.
   */
  public async requestDelegatedAppToken(appId: string): Promise<DelegatedAppToken | null> {
    try {
      const res = await this.fetcher('/api/icy-service-bus/delegated-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ appId }),
      });

      if (res.ok) {
        const data = (await res.json()) as { token?: DelegatedAppToken };
        if (data.token) {
          return data.token;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const icyAccountClient = new IcyAccountClientService();
