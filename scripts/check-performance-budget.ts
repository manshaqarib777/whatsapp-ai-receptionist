import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  performanceBudgetViolations,
  type AssetSize,
} from '../src/lib/performance-budget';

async function assets(root: string, directory = root): Promise<AssetSize[]> {
  const result: AssetSize[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await assets(root, path)));
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.css')) {
      result.push({ path: relative(root, path), bytes: (await stat(path)).size });
    }
  }
  return result;
}

async function main() {
  const measured = await assets('.next/static');
  const violations = performanceBudgetViolations(measured);
  if (violations.length) {
    throw new Error(`Performance budget exceeded:\n${violations.join('\n')}`);
  }
  const largest = measured.sort((a, b) => b.bytes - a.bytes)[0];
  console.log(
    `Performance budget passed for ${measured.length} assets; largest ${largest?.path ?? 'none'} (${largest?.bytes ?? 0} bytes).`,
  );
}

void main();
