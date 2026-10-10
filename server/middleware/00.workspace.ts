import { findSingleWorkspace } from '#server/utils/workspace-repo';

export default defineEventHandler(async (event) => {
  const workspace = await findSingleWorkspace();
  if (workspace)
    event.context.workspace = workspace;
});
