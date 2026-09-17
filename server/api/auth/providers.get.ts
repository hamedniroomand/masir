// The client cannot read the OAuth secrets, and runtime config is frozen, so
// the server reports which providers an operator configured.
export default defineEventHandler(() => {
  const { oauth } = useRuntimeConfig();
  return {
    google: Boolean(oauth?.google?.clientId),
    microsoft: Boolean(oauth?.microsoft?.clientId),
  };
});
