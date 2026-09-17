import { outboxProvider } from '#server/utils/mail-outbox';
import { resendProvider } from '#server/utils/mail-resend';
import { smtpProvider } from '#server/utils/mail-smtp';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailDriver {
  send: (message: MailMessage) => Promise<void>;
}

export interface MailConfig {
  driver: string;
  from: string;
  apiKey: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
    poolMax: number;
  };
}

// One strategy for each transport. create() gives back null when the config
// holds no credentials for that transport, so the resolver can try the next one.
export interface MailProvider {
  name: string;
  create: (config: MailConfig) => MailDriver | null;
}

const providers = new Map<string, MailProvider>();

let override: MailDriver | null = null;
let memoised: MailDriver | null = null;

export function registerMailProvider(provider: MailProvider) {
  providers.set(provider.name, provider);
  memoised = null;
}

export function mailProviderNames() {
  return [...providers.keys()];
}

// A deployment with no provider must still boot. The message goes to the log.
export function createLogDriver(): MailDriver {
  return {
    async send(message) {
      console.warn(`[mail] no provider configured; would send "${message.subject}" to ${message.to}`);
    },
  };
}

export function createMemoryDriver(): MailDriver & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

registerMailProvider(smtpProvider);
registerMailProvider(resendProvider);
registerMailProvider(outboxProvider);
registerMailProvider({ name: 'log', create: () => createLogDriver() });

// With no NUXT_MAIL_DRIVER, SMTP goes first. A host that is not set falls
// through, so a deployment that holds only an API key keeps working.
const DEFAULT_ORDER = ['smtp', 'resend'];

// The chosen name comes back with the driver, so a caller can report the choice
// without building the driver a second time.
export function buildMailDriver(config: MailConfig): { name: string; driver: MailDriver } {
  if (config.driver) {
    const driver = providers.get(config.driver)?.create(config);
    if (driver)
      return { name: config.driver, driver };
    console.warn(`[mail] provider "${config.driver}" is unknown or not configured; known providers are ${mailProviderNames().join(', ')}`);
    return { name: 'log', driver: createLogDriver() };
  }

  for (const name of DEFAULT_ORDER) {
    const driver = providers.get(name)?.create(config);
    if (driver)
      return { name, driver };
  }
  return { name: 'log', driver: createLogDriver() };
}

export function setMailDriver(driver: MailDriver | null) {
  override = driver;
  memoised = null;
}

function resolveDriver(): MailDriver {
  if (override)
    return override;
  if (memoised)
    return memoised;
  memoised = buildMailDriver(useRuntimeConfig().mail).driver;
  return memoised;
}

export function sendMail(message: MailMessage) {
  return resolveDriver().send(message);
}
