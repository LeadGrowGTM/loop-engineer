/** Audited CLI versions; unknown output fails closed rather than guessing compatibility. */
export const TREEHOUSE_STATUS_CONTRACTS = {
  '1.8.0': 'text',
  '3.1.0': 'json',
} as const;

export const LIFECYCLE_DEPENDENCY_VERSIONS = {
  'tasks-axi': ['0.1.1', '0.2.6'],
  treehouse: Object.keys(TREEHOUSE_STATUS_CONTRACTS),
} as const;

export function normalizeDependencyVersion(name: keyof typeof LIFECYCLE_DEPENDENCY_VERSIONS, output: string): string {
  return output.trim().replace(new RegExp(`^${name}\\s+`, 'i'), '').replace(/^v/, '');
}

export function supportedDependencyVersion(name: keyof typeof LIFECYCLE_DEPENDENCY_VERSIONS, output: string): boolean {
  return (LIFECYCLE_DEPENDENCY_VERSIONS[name] as readonly string[]).includes(normalizeDependencyVersion(name, output));
}
