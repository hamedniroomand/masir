import type { Transporter } from 'nodemailer';
import type { MailProvider } from '#server/utils/mail';

// An HTTP request waits for the send. Cut the wait short when the host is dead.
const TIMEOUT_MS = 10_000;

export const smtpProvider: MailProvider = {
  name: 'smtp',
  create(config) {
    const { host, port, user, password, secure, poolMax } = config.smtp;
    if (!host)
      return null;

    // nodemailer loads only when SMTP is the chosen transport. The pool keeps
    // the connection and the TLS handshake between messages.
    let pool: Promise<Transporter> | null = null;
    const open = () => import('nodemailer').then(({ default: nodemailer }) => nodemailer.createTransport({
      host,
      port,
      secure,
      pool: true,
      maxConnections: poolMax,
      auth: user ? { user, pass: password } : undefined,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    }));

    return {
      async send(message) {
        const mailer = await (pool ??= open());
        await mailer.sendMail({ from: config.from, ...message });
      },
    };
  },
};
