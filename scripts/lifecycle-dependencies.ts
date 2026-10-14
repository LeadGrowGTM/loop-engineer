/** Audited CLI versions; unknown output fails closed rather than guessing compatibility. */
export const LIFECYCLE_DEPENDENCY_VERSIONS = {
  'tasks-axi': ['0.1.1', '0.2.6'],
  treehouse: ['1.8.0', '3.1.0'],
} as const;

export function supportedDependencyVersion(name: keyof typeof LIFECYCLE_DEPENDENCY_VERSIONS, output: string): boolean {
  const normalized = output.trim().replace(new RegExp(`^${name}\\s+`, 'i'), '').replace(/^v/, '');
  return (LIFECYCLE_DEPENDENCY_VERSIONS[name] as readonly string[]).includes(normalized);
}
