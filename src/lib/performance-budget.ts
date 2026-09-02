export type AssetSize = { path: string; bytes: number };

export const MAX_JS_CHUNK_BYTES = 500 * 1024;
export const MAX_CSS_ASSET_BYTES = 150 * 1024;

export function performanceBudgetViolations(assets: AssetSize[]): string[] {
  return assets.flatMap((asset) => {
    const maximum = asset.path.endsWith('.js')
      ? MAX_JS_CHUNK_BYTES
      : asset.path.endsWith('.css')
        ? MAX_CSS_ASSET_BYTES
        : Infinity;
    return asset.bytes > maximum
      ? [`${asset.path} is ${asset.bytes} bytes (budget ${maximum})`]
      : [];
  });
}
