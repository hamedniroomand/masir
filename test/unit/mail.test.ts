import type { MailConfig } from '#server/utils/mail';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMailDriver, createMemoryDriver, sendMail, setMailDriver } from '#server/utils/mail';
import { createResendDriver } from '#server/utils/mail-resend';

const message = {
  to: 'sara@example.com',
  subject: 'Verify your email',
  html: '<p>token-123</p>',
  text: 'token-123',
};

function mailConfig(overrides: Partial<MailConfig> = {}): MailConfig {
  return {
    driver: '',
    from: 'Masir <no-reply@masir.dev>',
    apiKey: '',
    smtp: { host: '', port: 587, user: '', password: '', secure: false, poolMax: 5 },
    ...overrides,
  };
}

afterEach(() => {
  setMailDriver(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('provider registry', () => {
  it('picks smtp when a host is set', () => {
    const config = mailConfig({ smtp: { ...mailConfig().smtp, host: 'mail' } });
    expect(buildMailDriver(config).name).toBe('smtp');
  });

  it('falls back to resend when only an api key is set', () => {
    expect(buildMailDriver(mailConfig({ apiKey: 're_test_key' })).name).toBe('resend');
  });

  it('prefers smtp over resend when both are set', () => {
    const config = mailConfig({ apiKey: 're_test_key', smtp: { ...mailConfig().smtp, host: 'mail' } });
    expect(buildMailDriver(config).name).toBe('smtp');
  });

  it('falls back to the log driver when nothing is set', () => {
    expect(buildMailDriver(mailConfig()).name).toBe('log');
  });

  it('honours an explicit provider name', () => {
    expect(buildMailDriver(mailConfig({ driver: 'outbox' })).name).toBe('outbox');
  });

  it('warns and logs when the named provider is unknown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildMailDriver(mailConfig({ driver: 'sendmail' })).name).toBe('log');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns and logs when the named provider has no configuration', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildMailDriver(mailConfig({ driver: 'smtp' })).name).toBe('log');
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('memory driver', () => {
  it('keeps what it was given', async () => {
    const driver = createMemoryDriver();
    setMailDriver(driver);
    await sendMail(message);
    expect(driver.sent).toHaveLength(1);
    expect(driver.sent[0]!.subject).toBe('Verify your email');
    expect(driver.sent[0]!.text).toContain('token-123');
  });
});

describe('resend driver', () => {
  it('posts the message to the api', async () => {
    // Type the parameters, or mock.calls[0] is an empty tuple and the cast fails.
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ id: 'x' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await createResendDriver('re_test_key', 'Masir <no-reply@masir.dev>').send(message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(['sara@example.com']);
    expect(body.from).toBe('Masir <no-reply@masir.dev>');
    expect(body.subject).toBe('Verify your email');
  });

  it('throws with the status when the api refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, _init: RequestInit) =>
      new Response('bad key', { status: 401 })));
    await expect(createResendDriver('re_bad', 'a@b.dev').send(message))
      .rejects
      .toThrow(/401/);
  });
});
