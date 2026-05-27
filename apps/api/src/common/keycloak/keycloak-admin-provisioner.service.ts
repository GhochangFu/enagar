import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ProvisionTenantAdminInput = {
  tenantId: string;
  tenantCode: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword?: string;
};

export type ProvisionTenantAdminResult = {
  username: string;
  keycloak_user_id: string;
  password_hint: string;
};

/**
 * Idempotent Keycloak Admin API provisioning for tenant_admin users during State onboarding.
 */
@Injectable()
export class KeycloakAdminProvisionerService {
  private readonly logger = new Logger(KeycloakAdminProvisionerService.name);

  constructor(private readonly config: ConfigService) {}

  async provisionTenantAdmin(
    input: ProvisionTenantAdminInput,
  ): Promise<ProvisionTenantAdminResult> {
    const tenantCode = input.tenantCode.trim().toLowerCase();
    const username = (input.username?.trim() || `${tenantCode}-tenant-admin`).toLowerCase();
    const email = input.email?.trim() || `${username}@tenant.enagar.local`;
    const password =
      input.temporaryPassword?.trim() ||
      this.config.get<string>('KEYCLOAK_DUMMY_USER_PASSWORD') ||
      'DummyDev_2026!ChangeMe';

    const baseUrl = this.resolveKeycloakBaseUrl();
    const realm = this.config.get<string>('KEYCLOAK_REALM') ?? 'enagar';
    const adminUser = this.config.get<string>('KEYCLOAK_ADMIN') ?? 'admin';
    const adminPassword = this.config.get<string>('KEYCLOAK_ADMIN_PASSWORD');
    if (!adminPassword) {
      throw new Error('KEYCLOAK_ADMIN_PASSWORD is required for tenant admin provisioning');
    }

    const token = await this.fetchAdminToken(baseUrl, adminUser, adminPassword);
    await this.ensureUserProfileAttributes(baseUrl, realm, token);
    const userId = await this.upsertRealmUser(baseUrl, realm, token, {
      username,
      email,
      firstName: input.firstName?.trim() || 'Tenant',
      lastName: input.lastName?.trim() || 'Administrator',
      tenantId: input.tenantId,
      tenantCode: input.tenantCode.trim().toUpperCase(),
      password,
    });
    await this.assignRealmRole(baseUrl, realm, token, userId, 'tenant_admin');

    return {
      username,
      keycloak_user_id: userId,
      password_hint: password,
    };
  }

  /**
   * Server-side Admin API calls must use loopback HTTP on the VM (see KEYCLOAK_JWKS_URL).
   * Public KEYCLOAK_ISSUER_URL is for browser OAuth and JWT `iss` validation only.
   */
  private resolveKeycloakBaseUrl(): string {
    const explicitBase = this.config.get<string>('KEYCLOAK_BASE')?.trim();
    if (explicitBase) {
      return explicitBase.replace(/\/$/, '');
    }
    const issuer =
      this.config.get<string>('KEYCLOAK_ISSUER_URL') ?? 'http://127.0.0.1:8080/realms/enagar';
    const trimmed = issuer.replace(/\/$/, '');
    const realmsIdx = trimmed.indexOf('/realms/');
    return realmsIdx >= 0 ? trimmed.slice(0, realmsIdx) : trimmed;
  }

  private async fetchAdminToken(
    baseUrl: string,
    username: string,
    password: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username,
      password,
    });
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (error) {
      throw this.keycloakFetchError('admin token', baseUrl, error);
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Keycloak admin token failed: HTTP ${response.status} (${baseUrl})`,
      );
    }
    const json = (await response.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new Error('Keycloak admin token response missing access_token');
    }
    return json.access_token;
  }

  private async adminFetch(
    baseUrl: string,
    realm: string,
    token: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    try {
      return await fetch(`${baseUrl}/admin/realms/${realm}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw this.keycloakFetchError(`${method} ${path}`, baseUrl, error);
    }
  }

  private keycloakFetchError(
    operation: string,
    baseUrl: string,
    error: unknown,
  ): ServiceUnavailableException {
    const detail = error instanceof Error ? error.message : String(error);
    this.logger.error(`Keycloak ${operation} failed via ${baseUrl}: ${detail}`);
    return new ServiceUnavailableException(
      `Keycloak admin API unreachable during ${operation} (${baseUrl}): ${detail}`,
    );
  }

  private async ensureUserProfileAttributes(
    baseUrl: string,
    realm: string,
    token: string,
  ): Promise<void> {
    const read = await this.adminFetch(baseUrl, realm, token, 'GET', '/users/profile');
    if (!read.ok) {
      this.logger.warn(`Keycloak user profile read skipped: HTTP ${read.status}`);
      return;
    }
    const profile = (await read.json()) as {
      attributes?: Array<{ name: string }>;
    };
    const attributes = Array.isArray(profile.attributes) ? profile.attributes : [];
    const names = new Set(attributes.map((row) => row.name));
    let changed = false;
    for (const name of ['tenant_id', 'tenant_code', 'ward_id']) {
      if (!names.has(name)) {
        attributes.push({
          name,
          displayName: name,
          permissions: { view: ['admin', 'user'], edit: ['admin'] },
          multivalued: false,
        } as never);
        changed = true;
      }
    }
    if (!changed) {
      return;
    }
    const update = await this.adminFetch(baseUrl, realm, token, 'PUT', '/users/profile', {
      ...profile,
      attributes,
    });
    if (!update.ok && update.status !== 204) {
      this.logger.warn(`Keycloak user profile update: HTTP ${update.status}`);
    }
  }

  private async upsertRealmUser(
    baseUrl: string,
    realm: string,
    token: string,
    spec: {
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      tenantId: string;
      tenantCode: string;
      password: string;
    },
  ): Promise<string> {
    const existing = await this.findUserId(baseUrl, realm, token, spec.username);
    const payload = {
      username: spec.username,
      email: spec.email,
      enabled: true,
      emailVerified: true,
      firstName: spec.firstName,
      lastName: spec.lastName,
      attributes: {
        tenant_id: [spec.tenantId],
        tenant_code: [spec.tenantCode],
      },
    };

    let userId = existing;
    if (userId) {
      const update = await this.adminFetch(
        baseUrl,
        realm,
        token,
        'PUT',
        `/users/${userId}`,
        payload,
      );
      if (!update.ok && update.status !== 204) {
        throw new Error(`Keycloak user update failed: HTTP ${update.status}`);
      }
    } else {
      const create = await this.adminFetch(baseUrl, realm, token, 'POST', '/users', {
        ...payload,
        credentials: [{ type: 'password', value: spec.password, temporary: false }],
      });
      if (create.status === 201) {
        const location = create.headers.get('Location');
        userId = location?.split('/').pop() ?? null;
      } else if (create.status !== 409) {
        throw new Error(`Keycloak user create failed: HTTP ${create.status}`);
      }
      if (!userId) {
        userId = await this.findUserId(baseUrl, realm, token, spec.username);
      }
    }

    if (!userId) {
      throw new Error(`Could not resolve Keycloak user id for ${spec.username}`);
    }

    const pwd = await this.adminFetch(
      baseUrl,
      realm,
      token,
      'PUT',
      `/users/${userId}/reset-password`,
      {
        type: 'password',
        value: spec.password,
        temporary: false,
      },
    );
    if (!pwd.ok && pwd.status !== 204) {
      this.logger.warn(`Password reset for ${spec.username}: HTTP ${pwd.status}`);
    }

    return userId;
  }

  private async findUserId(
    baseUrl: string,
    realm: string,
    token: string,
    username: string,
  ): Promise<string | null> {
    const response = await this.adminFetch(
      baseUrl,
      realm,
      token,
      'GET',
      `/users?username=${encodeURIComponent(username)}&exact=true`,
    );
    if (!response.ok) {
      return null;
    }
    const rows = (await response.json()) as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  }

  private async assignRealmRole(
    baseUrl: string,
    realm: string,
    token: string,
    userId: string,
    roleName: string,
  ): Promise<void> {
    const rolesRes = await this.adminFetch(baseUrl, realm, token, 'GET', '/roles');
    if (!rolesRes.ok) {
      throw new Error(`Keycloak list roles failed: HTTP ${rolesRes.status}`);
    }
    const roles = (await rolesRes.json()) as Array<{ id: string; name: string }>;
    const role = roles.find((row) => row.name === roleName);
    if (!role) {
      throw new Error(`Keycloak realm role not found: ${roleName}`);
    }
    const assign = await this.adminFetch(
      baseUrl,
      realm,
      token,
      'POST',
      `/users/${userId}/role-mappings/realm`,
      [role],
    );
    if (!assign.ok && assign.status !== 204) {
      throw new Error(`Keycloak assign role failed: HTTP ${assign.status}`);
    }
  }
}
