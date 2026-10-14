import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePowerShell } from './goal-lifecycle/process';
const root = join(import.meta.dir, '..');
test('public marketplace resolves plugin and every bundled agent/command', () => {
  const plugin = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'));
  const marketplace = JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8'));
  expect(marketplace.plugins[0].name).toBe(plugin.name);
  expect(marketplace.plugins[0].version).toBe(plugin.version);
  expect(marketplace.plugins[0].source).toBe('./');
  expect(plugin.agents.map((p: string) => p.split('/').at(-1)).sort()).toEqual(readdirSync(join(root, '.claude/agents')).filter(p => p.startsWith('harness-') && p.endsWith('.md')).sort());
  for (const path of [...plugin.agents, plugin.commands]) expect(existsSync(join(root, path))).toBe(true);
});
test('PowerShell selection supports Unix, Windows, fallback and missing runtime', () => {
  const both = (name: string) => `/bin/${name}`;
  expect(resolvePowerShell('linux', both)).toBe('/bin/pwsh');
  expect(resolvePowerShell('darwin', both)).toBe('/bin/pwsh');
  expect(resolvePowerShell('win32', both)).toBe('/bin/powershell');
  expect(resolvePowerShell('linux', name => name === 'powershell' ? '/shim/powershell' : null)).toBe('/shim/powershell');
  expect(() => resolvePowerShell('linux', () => null)).toThrow('Provision PowerShell 7');
});
