# Integrations API

All routes use the standard `{ data }` / `{ error }` envelope, correlation header,
database-backed authentication, organization tenant scope, and server-side RBAC.
Connection responses contain non-secret configuration only.

## Routes

| Method | Route | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/integrations` | `settings:read` | List the provider catalog and safe connection state. |
| `PUT` | `/api/integrations/:provider` | `settings:update` | Create or update provider configuration and enabled state. |
| `POST` | `/api/integrations/:provider/test` | `settings:update` | Run a sandbox or configured live health check. |
| `DELETE` | `/api/integrations/:provider` | `settings:update` | Soft-disconnect the provider. |

Supported provider slugs are `meta`, `google`, `outlook`, `slack`, `hubspot`,
`stripe`, `zapier`, `make`, `n8n`, `salla`, and `shopify`.

`PUT` accepts `{ enabled, mode, config, version? }`. `config` is validated against a
strict provider schema; secret-shaped and unknown fields are rejected. `version` is
required when updating an existing connection.
# Credential encryption

Configuration writes may include an optional `credential` string (8–4096 characters).
It is encrypted server-side with AES-256-GCM and organization/provider authenticated
context. Responses expose only `credentialHint`; ciphertext and key material are never
selected. Omitting `credential` preserves the existing encrypted value. Live credential
writes require a valid `DATA_ENCRYPTION_KEY`.
