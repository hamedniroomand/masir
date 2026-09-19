import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIT_GROUPS, auditGroup, isAuditGroup, typesInGroup, typesOutsideGroup } from '#shared/audit-groups';

const serverDir = join(import.meta.dirname, '../../server');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

// The page groups every event. A type nobody put in a group would hide behind
// the security tab, so the map has to keep up with the server.
function typesTheServerWrites(): string[] {
  const found = new Set<string>();
  for (const file of filesUnder(serverDir)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/writeAuditEvent\((?:[^'()]*\?)?\s*'([a-z_]+)'(?:\s*:\s*'([a-z_]+)')?/g)) {
      found.add(match[1]!);
      if (match[2])
        found.add(match[2]);
    }
  }
  return [...found];
}

describe('auditGroup', () => {
  it('puts every type the server writes in exactly one group', () => {
    const types = typesTheServerWrites();
    expect(types.length).toBeGreaterThan(20);
    for (const type of types) {
      const group = AUDIT_GROUPS.filter(name => typesInGroup(name).includes(type));
      expect(group, `add "${type}" to shared/audit-groups.ts`).toHaveLength(1);
    }
  });

  it('sends an unknown type to security', () => {
    expect(auditGroup('something_new')).toBe('security');
    expect(typesOutsideGroup('security')).not.toContain('something_new');
    expect(typesOutsideGroup('security')).toContain('link_created');
    expect(typesOutsideGroup('security')).not.toContain('login_failed');
  });

  it('keeps link and alias events together', () => {
    for (const type of ['link_created', 'link_alias_added', 'link_alias_removed', 'link_slug_changed'])
      expect(auditGroup(type)).toBe('links');
  });

  it('recognises only the four groups', () => {
    expect(isAuditGroup('links')).toBe(true);
    expect(isAuditGroup('nothing')).toBe(false);
  });
});
