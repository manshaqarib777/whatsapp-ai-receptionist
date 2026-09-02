import type { PrismaClient } from '@prisma/client';

import {
  ARABIC_NAMES,
  COMPANY_NAMES,
  LATIN_NAMES,
  SEED_NOW,
  daysFromNow,
  seedId,
  syntheticPhone,
  type Random,
} from './support';
import type { SeededTenants } from './tenants';

/**
 * Companies and contacts.
 *
 * DATABASE_RULES.md → Seed Data: "Contacts with and without consent, including an
 * opted-out contact", plus a right-to-left name and a 60-character company name among
 * the deliberate edge cases.
 *
 * Consent is not decoration. Milestone 14 may not broadcast to a contact who has
 * opted out, so a seed without an opted-out contact cannot demonstrate the rule being
 * honoured — or catch it being broken.
 */

export type SeededContacts = Awaited<ReturnType<typeof seedContacts>>;

export async function seedContacts(
  prisma: PrismaClient,
  tenants: SeededTenants,
  random: Random,
) {
  const companies: string[] = [];

  for (const [index, name] of COMPANY_NAMES.entries()) {
    const branch = index % 2 === 0 ? tenants.northwind.riyadh : tenants.northwind.jeddah;

    const company = await prisma.company.create({
      data: {
        id: seedId('company', index + 1),
        organizationId: tenants.northwind.id,
        branchId: branch,
        name,
        vatNumber: `3001234560000${index}`,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });

    companies.push(company.id);
  }

  const riyadhContacts: string[] = [];
  const jeddahContacts: string[] = [];

  // Arabic names first, so the RTL edge case is present from row one rather than
  // buried on page three where nobody scrolls.
  const names = [...ARABIC_NAMES, ...LATIN_NAMES];

  for (const [index, displayName] of names.entries()) {
    const toJeddah = index % 3 === 2;
    const branchId = toJeddah ? tenants.northwind.jeddah : tenants.northwind.riyadh;

    // Three consent states, deliberately distributed rather than random, so every
    // state is guaranteed present no matter how the pool changes:
    //   index 0     → opted out (had consent, then withdrew it)
    //   index 1     → never consented
    //   everything else → consented
    const optedOut = index === 0;
    const neverConsented = index === 1;

    const contact = await prisma.contact.create({
      data: {
        id: seedId('contact', index + 1),
        organizationId: tenants.northwind.id,
        branchId,
        companyId: index < companies.length ? (companies[index] as string) : null,
        phoneNumber: syntheticPhone(index + 1),
        displayName,
        email: `contact${index + 1}@example.test`,
        locale: index < ARABIC_NAMES.length ? 'ar' : 'en',
        lifecycleStage: random.pick(['lead', 'prospect', 'customer'] as const),
        hasConsent: !optedOut && !neverConsented,
        optedOutAt: optedOut ? daysFromNow(-12) : null,
        // Spread over weeks, not all at now() — a dashboard filtered to "last 7 days"
        // must show fewer rows than one filtered to "last 90".
        createdAt: daysFromNow(-random.int(1, 120)),
        updatedAt: SEED_NOW,
      },
    });

    (toJeddah ? jeddahContacts : riyadhContacts).push(contact.id);
  }

  // Tenant 2 gets its own contacts, reusing the SAME phone numbers as tenant 1.
  // The partial unique index is per organization, so this must be legal — and if a
  // query ever leaks across tenants, identical numbers make it obvious rather than
  // subtle.
  const beaconContacts: string[] = [];

  for (let index = 0; index < 4; index += 1) {
    const contact = await prisma.contact.create({
      data: {
        id: seedId('beacon-contact', index + 1),
        organizationId: tenants.beacon.id,
        branchId: tenants.beacon.main,
        phoneNumber: syntheticPhone(index + 1),
        displayName: LATIN_NAMES[index] ?? `Beacon Customer ${index + 1}`,
        email: `beacon${index + 1}@example.test`,
        hasConsent: true,
        createdAt: daysFromNow(-random.int(1, 60)),
        updatedAt: SEED_NOW,
      },
    });

    beaconContacts.push(contact.id);
  }

  return { companies, riyadhContacts, jeddahContacts, beaconContacts };
}
