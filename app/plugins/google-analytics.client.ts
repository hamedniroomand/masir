export default defineNuxtPlugin(() => {
  const id = useRuntimeConfig().public.scripts?.googleAnalytics?.id;
  if (!id)
    return;
  // Short-link visitors must not pay for the dashboard analytics tag.
  if (useError().value)
    return;
  if (useRoute().path.startsWith('/p/'))
    return;
  useScriptGoogleAnalytics();
});
