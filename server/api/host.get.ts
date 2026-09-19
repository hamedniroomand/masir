import { appUrl } from '#shared/deployment';

// Public. The client cannot tell the root host from the app host on its own.
export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  return {
    landing: Boolean(event.context.landing),
    appUrl: appUrl(config as never),
    registration: Boolean(config.allowRegistration),
    demo: Boolean(config.demoEnabled),
  };
});
