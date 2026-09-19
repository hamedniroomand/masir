export type TurnstileApi = {
  render: (host: HTMLElement, options: Record<string, unknown>) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let pending: Promise<TurnstileApi> | null = null;

export function turnstileOf(): TurnstileApi | undefined {
  return (window as { turnstile?: TurnstileApi }).turnstile;
}

// One script tag for the whole session. A second page reuses the loaded API.
export function loadTurnstile(): Promise<TurnstileApi> {
  const loaded = turnstileOf();
  if (loaded)
    return Promise.resolve(loaded);
  pending ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const api = turnstileOf();
      if (api)
        resolve(api);
      else
        reject(new Error('Turnstile did not load.'));
    };
    script.onerror = () => reject(new Error('Turnstile did not load.'));
    document.head.append(script);
  });
  return pending;
}
