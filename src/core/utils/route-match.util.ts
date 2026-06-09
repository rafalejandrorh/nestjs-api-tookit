import type { ToolkitOptions } from '../interfaces/toolkit-options.interface';

export function matchesToolkitRoute(
  path: string,
  options: ToolkitOptions['globalMatch'],
): boolean {
  if (!options) {
    return true;
  }

  const isExcluded = options.exclude?.some(pattern => path.match(pattern));
  if (isExcluded) {
    return false;
  }

  const isIncluded = options.include?.some(pattern => path.match(pattern));
  return isIncluded ?? false;
}