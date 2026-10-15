import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminAccessMode, adminAccessIdentity } from '../src/admin-access.js';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));

test('mantem banco e bucket existentes no proximo deploy', () => {
  assert.equal(config.name, 'zion-site');
  assert.equal(config.d1_databases?.[0]?.database_name, 'zion');
  assert.equal(config.d1_databases?.[0]?.database_id, '1d5194e4-0be4-4f9c-a245-eee72b472743');
  assert.equal(config.r2_buckets?.[0]?.bucket_name, 'zion');
});

test('credencial do painel nao deve ser incluida nas vars de configuracao', () => {
  assert.equal(Object.hasOwn(config.vars || {}, 'ADMIN_PASSWORD'), false);
});

test('configuracao parcial de Access nunca reativa login antigo por PIN', () => {
  assert.equal(adminAccessMode({ ADMIN_ACCESS_TEAM_DOMAIN: 'https://example.cloudflareaccess.com' }), true);
  assert.equal(adminAccessMode({ ADMIN_ACCESS_AUD: 'audience' }), true);
});

test('Access rejeita requisicao sem JWT na origem', async () => {
  const diagnosis = {};
  const env = {
    ADMIN_ACCESS_TEAM_DOMAIN: 'https://example.cloudflareaccess.com',
    ADMIN_ACCESS_AUD: 'audience-1234567890',
    ADMIN_ALLOWED_EMAIL: 'ianlucas.fm@icloud.com'
  };
  const identity = await adminAccessIdentity(new Request('https://example.test/admin'), env, diagnosis);
  assert.equal(identity, null);
  assert.equal(diagnosis.code, 'ACCESS_TOKEN_MISSING');
});
