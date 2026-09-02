import { describe, expect, it } from 'vitest';

import {
  PERMISSIONS,
  ROLES,
  canAssignRole,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isRole,
  permissionsForRole,
  type Permission,
  type Role,
} from '@/features/auth/permissions';

/**
 * The permission matrix is the authorization model. If it is wrong, every server-side
 * check built on it is wrong. These tests assert the matrix exhaustively rather than
 * spot-checking it.
 */

describe('isRole', () => {
  it.each(ROLES)('accepts the known role %s', (role) => {
    expect(isRole(role)).toBe(true);
  });

  it.each([['superuser'], ['OWNER'], [''], ['admin ']])(
    'rejects the unknown role %s',
    (value) => {
      expect(isRole(value)).toBe(false);
    },
  );

  it('rejects non-string values', () => {
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(1)).toBe(false);
    expect(isRole({})).toBe(false);
  });
});

describe('hasPermission — fail closed', () => {
  it('denies every permission to an unknown role', () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission('superuser', permission)).toBe(false);
    }
  });

  it('denies every permission to an empty role', () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission('', permission)).toBe(false);
    }
  });

  it('is case-sensitive — "Owner" is not "owner"', () => {
    expect(hasPermission('Owner', 'organization:delete')).toBe(false);
  });
});

describe('owner', () => {
  it('holds every declared permission', () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission('owner', permission)).toBe(true);
    }
  });
});

describe('admin', () => {
  it('cannot delete the organization', () => {
    expect(hasPermission('admin', 'organization:delete')).toBe(false);
  });

  it('cannot access billing', () => {
    expect(hasPermission('admin', 'organization:billing')).toBe(false);
  });

  it('can manage members', () => {
    expect(
      hasAllPermissions('admin', [
        'member:read',
        'member:invite',
        'member:update',
        'member:remove',
      ]),
    ).toBe(true);
  });

  it('can read the audit log', () => {
    expect(hasPermission('admin', 'audit:read')).toBe(true);
  });

  it('can approve knowledge documents', () => {
    expect(hasPermission('admin', 'knowledge:approve')).toBe(true);
  });
});

describe('member', () => {
  it('can work with conversations but not delete them', () => {
    expect(hasPermission('member', 'conversation:read')).toBe(true);
    expect(hasPermission('member', 'conversation:write')).toBe(true);
    expect(hasPermission('member', 'conversation:assign')).toBe(true);
    expect(hasPermission('member', 'conversation:delete')).toBe(false);
  });

  it('cannot manage members', () => {
    expect(
      hasAnyPermission('member', ['member:invite', 'member:update', 'member:remove']),
    ).toBe(false);
  });

  it('cannot read the audit log', () => {
    expect(hasPermission('member', 'audit:read')).toBe(false);
  });

  it('cannot change settings', () => {
    expect(hasPermission('member', 'settings:update')).toBe(false);
  });

  it('can write knowledge but not approve it', () => {
    expect(hasPermission('member', 'knowledge:read')).toBe(true);
    expect(hasPermission('member', 'knowledge:write')).toBe(true);
    expect(hasPermission('member', 'knowledge:approve')).toBe(false);
  });
});

describe('viewer', () => {
  const writePermissions: Permission[] = [
    'organization:update',
    'organization:delete',
    'organization:billing',
    'member:invite',
    'member:update',
    'member:remove',
    'conversation:write',
    'conversation:assign',
    'conversation:delete',
    'contact:write',
    'contact:delete',
    'settings:update',
    'knowledge:write',
    'knowledge:approve',
  ];

  it('holds no write permission of any kind', () => {
    for (const permission of writePermissions) {
      expect(hasPermission('viewer', permission)).toBe(false);
    }
  });

  it('can read conversations and contacts', () => {
    expect(hasPermission('viewer', 'conversation:read')).toBe(true);
    expect(hasPermission('viewer', 'contact:read')).toBe(true);
  });

  it('can read but not write knowledge', () => {
    expect(hasPermission('viewer', 'knowledge:read')).toBe(true);
    expect(hasPermission('viewer', 'knowledge:write')).toBe(false);
    expect(hasPermission('viewer', 'knowledge:approve')).toBe(false);
  });

  it('cannot read the audit log', () => {
    expect(hasPermission('viewer', 'audit:read')).toBe(false);
  });
});

describe('privilege ordering', () => {
  it('grants each role at least as much as the one below it', () => {
    const descending: Role[] = ['owner', 'admin', 'member', 'viewer'];

    for (let i = 0; i < descending.length - 1; i += 1) {
      const higherRole = descending[i];
      const lowerRole = descending[i + 1];
      if (!higherRole || !lowerRole) continue;

      const higher = permissionsForRole(higherRole);
      const lower = permissionsForRole(lowerRole);

      for (const permission of lower) {
        expect(
          higher.includes(permission),
          `${higherRole} should hold ${permission} because ${lowerRole} does`,
        ).toBe(true);
      }
    }
  });
});

describe('canAssignRole — privilege escalation', () => {
  it('lets only an owner create another owner', () => {
    expect(canAssignRole('owner', 'owner')).toBe(true);
    expect(canAssignRole('admin', 'owner')).toBe(false);
    expect(canAssignRole('member', 'owner')).toBe(false);
    expect(canAssignRole('viewer', 'owner')).toBe(false);
  });

  it('lets an admin assign non-owner roles', () => {
    expect(canAssignRole('admin', 'admin')).toBe(true);
    expect(canAssignRole('admin', 'member')).toBe(true);
    expect(canAssignRole('admin', 'viewer')).toBe(true);
  });

  it('denies role assignment to roles without member:update', () => {
    expect(canAssignRole('member', 'viewer')).toBe(false);
    expect(canAssignRole('viewer', 'viewer')).toBe(false);
  });

  it('rejects unknown roles on either side', () => {
    expect(canAssignRole('superuser', 'member')).toBe(false);
    expect(canAssignRole('owner', 'superuser')).toBe(false);
  });
});

describe('hasAllPermissions / hasAnyPermission', () => {
  it('hasAll requires every permission', () => {
    expect(hasAllPermissions('member', ['conversation:read', 'conversation:write'])).toBe(
      true,
    );
    expect(
      hasAllPermissions('member', ['conversation:read', 'conversation:delete']),
    ).toBe(false);
  });

  it('hasAny requires one', () => {
    expect(hasAnyPermission('member', ['audit:read', 'conversation:read'])).toBe(true);
    expect(hasAnyPermission('viewer', ['audit:read', 'conversation:write'])).toBe(false);
  });

  it('an empty list is vacuously true for hasAll and false for hasAny', () => {
    expect(hasAllPermissions('viewer', [])).toBe(true);
    expect(hasAnyPermission('viewer', [])).toBe(false);
  });
});
