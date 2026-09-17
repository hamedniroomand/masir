import type { OAuthProfile } from '#server/utils/identity-repo';
import { writeAuditEvent } from '#server/utils/audit-log';
import { resolveOAuthUser, setSessionUser } from '#server/utils/identity-repo';

export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },
  async onSuccess(event, { user }) {
    const result = await resolveOAuthUser('GOOGLE', user as OAuthProfile);
    if (!result.ok) {
      await writeAuditEvent('oauth_refused', { provider: 'GOOGLE', reason: result.reason });
      return sendRedirect(event, `/login?error=${encodeURIComponent(result.reason)}`);
    }
    await setSessionUser(event, result.user);
    await writeAuditEvent('oauth_login', { provider: 'GOOGLE' }, { actor: result.user.id });
    return sendRedirect(event, '/');
  },
  async onError(event, error) {
    await writeAuditEvent('oauth_failed', { provider: 'GOOGLE', message: error.message });
    return sendRedirect(event, '/login?error=Sign+in+with+Google+failed.');
  },
});
