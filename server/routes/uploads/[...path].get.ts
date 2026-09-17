import { resolveInRoot } from '#server/utils/storage-key';

// An s3 deployment writes nothing under the local root, so every path here
// answers 404 for it.
export default defineEventHandler(async (event) => {
  const { localRoot } = useRuntimeConfig().storage;
  const key = getRouterParam(event, 'path');

  const notFound = () => createError({ statusCode: 404, statusMessage: 'Not found' });
  if (!key)
    throw notFound();

  let file: ReturnType<typeof Bun.file>;
  try {
    file = Bun.file(resolveInRoot(localRoot, key));
  }
  catch {
    // resolveInRoot refuses a key that climbs out of the root.
    throw notFound();
  }

  if (!await file.exists())
    throw notFound();

  setResponseHeaders(event, {
    'Content-Type': file.type,
    'Content-Length': String(file.size),
    // The content type comes from the file name, so stop the browser guessing.
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=3600',
  });
  return file.stream();
});
