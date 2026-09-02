# Milestone 19 — Integrations

## Objective

Provide one secure, tenant-scoped place to configure, inspect, test, enable, and
disconnect every integration named by the PRD. The local demo must remain useful
without third-party accounts, while production connections fail closed until their
server-side credentials are supplied.

## Requirements

Integrations

Meta

Google

Outlook

Slack

HubSpot

Stripe

Zapier

Make

n8n

Salla

Shopify

STOP

## Architecture Decisions

- Add a vertical `src/features/integrations/` slice with catalog, validators,
  repository, service, client, components, and tests.
- Persist one organization-scoped connection per provider. Branch scope is not added
  because credentials and billing integrations belong to the organization; adapters
  may carry a selected branch in non-secret configuration when a provider requires it.
- Keep provider capabilities and setup fields in a closed server-owned catalog.
- Store only non-secret configuration and masked credential metadata. Real secrets
  remain server-side environment/secret-manager concerns and are never returned by
  APIs or embedded in Client Component props.
- Model external side effects behind an adapter contract. Sandbox tests are local and
  deterministic; live calls fail closed unless explicitly configured.
- Follow the installed Next.js 16.2 route-handler, authentication, backend-for-
  frontend, data-security, and environment-variable guidance.

## Dependencies

- Upstream: Milestones 2, 4, 12, 16, and 18.
- New packages: none.
- External credentials: optional; none required for local demo or automated tests.

## Database Impact

- Add `integration_connections`, unique on `(organization_id, provider)`, with status,
  enabled flag, non-secret JSON config, masked credential metadata, health timestamps,
  bounded error text, optimistic version, audit timestamps, and soft deletion.
- Add provider/status enums and organization/status indexes.
- Migration is additive. Rollback drops only the new table and enums.

## API Impact

- `GET /api/integrations` lists catalog entries merged with safe connection state.
- `PUT /api/integrations/:provider` validates and upserts safe configuration.
- `POST /api/integrations/:provider/test` runs the provider's fail-closed health check.
- `DELETE /api/integrations/:provider` soft-disconnects the connection.
- Reads require `settings:read`; mutations require `settings:update` and emit audit
  events. Unknown providers and cross-tenant data never leak.

## UI Impact

- Add `/settings/integrations` with provider cards, capability descriptions, status,
  safe configuration, test, enable/disable, and disconnect controls.
- Include loading, empty, validation, error, success, and read-only states; keyboard
  access, visible labels, RTL-safe layout, and 320px reflow.

## AI Impact

- None. Integration configuration is not added to prompts or model context.

## Security Considerations

- Never persist OAuth access tokens, client secrets, webhook secrets, API keys, or
  authorization codes in `config`; strict per-provider schemas reject unknown keys.
- APIs serialize a fixed safe projection and never return raw database JSON blindly.
- Mutations are admin/owner only, tenant scoped, version checked, rate limited by the
  shared API controls, and audit logged without configuration values.
- Health checks never make an external request in sandbox mode. Live mode fails closed
  unless server-side configuration is present.

## Testing Strategy

- Unit: provider catalog, strict schemas, safe projections, state transitions.
- Integration: list/upsert/test/disable/disconnect, optimistic conflict, RBAC, audit,
  and tenant isolation against PostgreSQL.
- Component: all states, mutation feedback, read-only rendering, RTL, and axe.
- E2E: configure a sandbox integration, test it, disable it, and disconnect it.
- Gate: typecheck, lint, Vitest, Playwright, build, schema drift, and dependency audit.

## Risks

1. **Credential leakage.** Mitigate with allow-listed non-secret schemas and fixed DTOs.
2. **A simulated connection mistaken for production.** Display sandbox mode explicitly
   and keep live health checks unconfigured until server secrets exist.
3. **Provider behavior divergence.** Keep a narrow adapter contract and independent
   provider capability metadata.
4. **Concurrent settings overwrite.** Use the record version for optimistic locking.
