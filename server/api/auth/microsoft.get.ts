import type { OAuthProfile } from '#server/utils/identity-repo';
import { resolveOAuthUser, setSessionUser } from '#server/utils/identity-repo';
import { writeSecurityEvent } from '#server/utils/security-log';

export default defineOAuthMicrosoftEventHandler({
  config: { scope: ['User.Read', 'openid', 'email', 'profile'] },
  async onSuccess(event, { user }) {
    const result = await resolveOAuthUser('MICROSOFT', user as OAuthProfile);
    if (!result.ok) {
      await writeSecurityEvent('oauth_refused', { provider: 'MICROSOFT', reason: result.reason });
      return sendRedirect(event, `/login?error=${encodeURIComponent(result.reason)}`);
    }
    await setSessionUser(event, result.user);
    await writeSecurityEvent('oauth_login', { provider: 'MICROSOFT' }, { actor: result.user.id });
    return sendRedirect(event, '/');
  },
  async onError(event, error) {
    await writeSecurityEvent('oauth_failed', { provider: 'MICROSOFT', message: error.message });
    return sendRedirect(event, '/login?error=Sign+in+with+Microsoft+failed.');
  },
});
