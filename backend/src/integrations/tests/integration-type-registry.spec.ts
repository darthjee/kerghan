import { IntegrationTypeRegistry } from '../types/integration-type-registry.js';
import type { IntegrationTypeStrategy } from '../types/integration-type-strategy.js';

function strategy(
  type: IntegrationTypeStrategy['type'],
  flows: IntegrationTypeStrategy['flows'],
  isEnabled?: () => boolean,
): IntegrationTypeStrategy {
  return { type, flows, ...(isEnabled ? { isEnabled } : {}) } as unknown as IntegrationTypeStrategy;
}

describe('IntegrationTypeRegistry', () => {
  const pat = strategy('pat', { credentialPaste: true, redirect: false });
  const oauth = strategy('oauth_app', { credentialPaste: false, redirect: true }, () => false);
  const app = strategy('github_app', { credentialPaste: false, redirect: true }, () => true);
  const registry = new IntegrationTypeRegistry([pat, oauth, app]);

  it('resolves each registered type', () => {
    expect(registry.get('pat')).toBe(pat);
    expect(registry.get('oauth_app')).toBe(oauth);
    expect(registry.find('github_app')).toBe(app);
  });

  it('rejects an unknown type', () => {
    expect(() => registry.get('carrier_pigeon')).toThrow('unknown integration type');
    expect(registry.find('carrier_pigeon')).toBeUndefined();
  });

  it('lists enabled types in registry order, leaving disabled ones out', () => {
    expect(registry.enabledTypes()).toEqual([
      { type: 'pat', flows: { credentialPaste: true, redirect: false } },
      { type: 'github_app', flows: { credentialPaste: false, redirect: true } },
    ]);
  });

  it('returns a copy of the flows', () => {
    registry.enabledTypes()[0].flows.redirect = true;

    expect(pat.flows.redirect).toBe(false);
  });

  it('lists oauth_app after pat only while it is enabled', () => {
    const disabled = new IntegrationTypeRegistry([pat, strategy('oauth_app', { credentialPaste: false, redirect: true }, () => false)]);
    const enabled = new IntegrationTypeRegistry([pat, strategy('oauth_app', { credentialPaste: false, redirect: true }, () => true)]);

    expect(disabled.enabledTypes().map(({ type }) => type)).toEqual(['pat']);
    expect(enabled.enabledTypes()).toEqual([
      { type: 'pat', flows: { credentialPaste: true, redirect: false } },
      { type: 'oauth_app', flows: { credentialPaste: false, redirect: true } },
    ]);
  });
});
