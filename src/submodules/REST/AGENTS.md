# Agent Instructions: REST Module

When making any changes to the REST API (routes, controllers, or middleware), you MUST update the central API documentation in `docs/API.md` to reflect these changes.

Ensure that:
1. New endpoints are added with their respective methods, parameters, and response formats.
2. Modified endpoints are updated to match the new behavior.
3. Removed endpoints are deleted from the documentation.
4. Any changes to authentication, permissions (`requiresAuth`, `requiresPermission`) or global middleware are updated in the relevant sections.

Notes
- Register new route modules in `routes/index.ts`.
- Handlers are async; throw the errors from `errors.ts` (or call `next(error)`) rather than returning them.

## Completion: commit and push

- Unless the user explicitly asks otherwise, completing a task includes committing and pushing all
  working-tree changes, including pre-existing edits and new files. This is standing authorization;
  do not ask for separate confirmation to commit or push.
- Run checks appropriate to the changes, preserve existing work, stage all repository changes, and
  create a descriptive commit. Push the current branch to its configured remote without force.
- Commit and push changed submodules first, then commit and push the parent repository with the
  updated submodule references.
- When multiple agents share a checkout, coordinate one final commit and push after all workers
  finish their changes.
- Verify that the push succeeded and the working trees are clean. Report the commit IDs and any
  check or push failures.
