# Local Demo Data

Run `npm run db:deploy && npm run db:seed`, then `npm run dev` and open
`http://localhost:3000/login`.

All seeded accounts use password: `DemoPass!2026`

| Email | Northwind Dental role | Beacon Auto Care role | Best use |
|---|---|---|---|
| `owner@northwind.test` | Owner | — | Test every management and billing surface. |
| `admin@northwind.test` | Admin | — | Test management without owner-only operations. |
| `member@northwind.test` | Member | — | Test daily operational writes and RBAC limits. |
| `viewer@northwind.test` | Viewer | — | Test read-only behavior. |
| `consultant@example.test` | Viewer | Owner | Test tenant switching and isolation. |
| `operator@platform.test` | Platform operator | Platform operator | Test the cross-tenant admin portal. |

Northwind has Riyadh and Jeddah branches. It contains synthetic contacts,
conversations, messages, appointments, CRM deals, quotes, invoices, knowledge,
AI runs, workflows, broadcasts, analytics source data, reviews, loyalty, coupons,
referrals, eight AI specialists (with Marketing intentionally disabled), and sandbox
connections for every Milestone 19 provider. Beacon contains
parallel isolation data and its own Stripe sandbox connection.

All phone numbers, domains, customer text, provider ids, and connection values are
synthetic. Sandbox integration tests do not contact external services.
