import { appUrl } from '#shared/deployment';

export type HostInfo = { landing: boolean; appUrl: string; registration: boolean };

// The server reads the host from the request. The client asks once and keeps
// the answer under one key, so the middleware and the page share it.
export function useHostInfo() {
  const event = useRequestEvent();
  const config = useRuntimeConfig();
  return useAsyncData<HostInfo>('host', () => import.meta.server
    ? Promise.resolve({
        landing: Boolean(event?.context.landing),
        appUrl: appUrl(config as never),
        registration: Boolean(config.allowRegistration),
      })
    : $fetch<HostInfo>('/api/host'));
}
