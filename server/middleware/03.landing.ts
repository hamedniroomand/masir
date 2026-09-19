import { removeResponseHeader } from 'h3';
import { appUrl } from '#shared/deployment';

// Paths the root keeps when the app lives on its own host: the API, build
// assets, uploads, the unlock page, the abuse report page, and static files.
// Short links never reach here; 01.redirect answers them first.
const ROOT_PREFIXES = ['/api', '/_nuxt', '/__nuxt', '/uploads', '/p', '/report'];

function staysOnRoot(pathname: string): boolean {
  const [first = ''] = pathname.slice(1).split('/');
  if (first.includes('.'))
    return true;
  return ROOT_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default defineEventHandler((event) => {
  const pathname = event.path.split('?')[0] ?? '/';

  if (pathname === '/') {
    if (event.context.landing) {
      // The blanket route rule marks every page noindex. The landing page is
      // the one page a crawler should read.
      removeResponseHeader(event, 'X-Robots-Tag');
      return;
    }
    // The links list renders on the client, as every other app page does.
    // Only the landing page renders on the server.
    event.context.nuxt = { ...event.context.nuxt, noSSR: true };
    return;
  }

  if (!event.context.landing || staysOnRoot(pathname))
    return;
  return sendRedirect(event, `${appUrl(useRuntimeConfig() as never)}${event.path}`, 302);
});
