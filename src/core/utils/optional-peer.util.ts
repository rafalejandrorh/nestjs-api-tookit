export function loadOptionalPeer<TModule extends Record<string, unknown>>(
  packageName: string,
  featureName: string,
): TModule {
  try {
    return require(packageName) as TModule;
  } catch {
    throw new Error(
      `Missing optional peer dependency "${packageName}" required for ${featureName}. Install it in your app dependencies before enabling this feature.`,
    );
  }
}
