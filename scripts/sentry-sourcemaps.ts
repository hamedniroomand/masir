import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// The Sentry bundler plugin stamps every client chunk with a Debug ID, but it
// writes that id into the map only when it uploads the map itself. A public
// image has no auth token at build, so the container uploads later and the id
// must already be in the map.
const DEBUG_ID = /sentry-dbid-([0-9a-f-]{36})/;

// Nitro bakes the size of each file under .output/public into its asset
// manifest, so an edit after the build breaks Content-Length. A map under
// /_nuxt is also the full client source. Both problems go away when the maps
// leave the public directory before the manifest is written.
export async function collectSourceMaps(publicDir: string, outDir: string) {
  let count = 0;
  for (const name of await readdir(publicDir, { recursive: true })) {
    if (!name.endsWith('.map'))
      continue;
    const map = join(publicDir, name);
    const chunk = await readFile(join(publicDir, name.slice(0, -4)), 'utf8').catch(() => '');
    const debugId = DEBUG_ID.exec(chunk)?.[1];
    if (debugId) {
      const target = join(outDir, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, JSON.stringify({ ...JSON.parse(await readFile(map, 'utf8')), debug_id: debugId }));
      // sentry-cli reads the id of a chunk from this comment. The chunk keeps
      // the id in a variable as well, which only the browser reads.
      await appendFile(join(publicDir, name.slice(0, -4)), `\n//# debugId=${debugId}\n`);
      count += 1;
    }
    await rm(map);
  }
  return count;
}
