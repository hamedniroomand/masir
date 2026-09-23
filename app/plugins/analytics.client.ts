export default defineNuxtPlugin(() => {
  const scripts = useRuntimeConfig().public.scripts;
  const googleAnalyticsId = scripts?.googleAnalytics?.id;
  const umami = scripts?.umamiAnalytics;
  if (!googleAnalyticsId && !umami?.websiteId)
    return;
  // Short-link visitors must not pay for the dashboard analytics tag.
  if (useError().value)
    return;
  // password page for protected short links.
  if (useRoute().path.startsWith('/p/'))
    return;
  if (googleAnalyticsId)
    useScriptGoogleAnalytics();
  if (umami?.websiteId) {
    // A self-hosted Umami serves its own tracker. Empty keeps Umami Cloud.
    // ponytail: assumes the default tracker name. An instance with
    // TRACKER_SCRIPT_NAME set needs a script src setting.
    const hostUrl = umami.hostUrl?.replace(/\/+$/, '');
    useScriptUmamiAnalytics({ hostUrl, scriptInput: hostUrl ? { src: `${hostUrl}/script.js` } : undefined });
    // The recorder reads the session from the tracker above. Without a host
    // it sends to Umami Cloud, so a self-hosted Umami must pass its own.
    if (umami.replays) {
      useScript({
        key: 'umamiRecorder',
        src: `${hostUrl || 'https://cloud.umami.is'}/recorder.js`,
        'data-website-id': umami.websiteId,
        'data-host-url': hostUrl || undefined,
      });
    }
  }
});
