import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDriver, createResendDriver, sendMail, setMailDriver } from '#server/utils/mail';

const message = {
  to: 'sara@example.com',
  subject: 'Verify your email',
  html: '<p>token-123</p>',
  text: 'token-123',
};

afterEach(() => {
  setMailDriver(null);
  vi.unstubAllGlobals();
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

    await createResendDriver('re_test_key', 'Linkyard <no-reply@linkyard.dev>').send(message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(['sara@example.com']);
    expect(body.from).toBe('Linkyard <no-reply@linkyard.dev>');
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
