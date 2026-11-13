# Agents

## More than one agent may be working here at the same time

Several Claude sessions (and Eddie, from two laptops) can be editing this repo and
this branch at once, often in separate worktrees of the same clone. Assume someone
else is mid-change.

- **`git fetch` and check `git status` before you start and again before you commit.**
  Files you did not touch may be modified or appear while you work.
- **Commit only the files you changed.** Stage by path (`git add <file>`), never
  `git add -A` / `git add .` / `git commit -a`. Another agent's uncommitted edits are
  not yours to commit, revert, stash or "clean up".
- **Never** `git reset --hard`, `git checkout -- <file>`, `git clean`, `git stash`, or
  force-push on a shared branch.
- **Pull before you push** (`git pull --rebase`). If the rebase conflicts in a file you
  did not write, stop and ask rather than resolving it for the other agent.
- **Keep commits small and scoped** so parallel work merges cleanly.
- **Dev servers:** pick a port nobody else is using (check
  `Get-NetTCPConnection -LocalPort <port>`), and stop only the process you started.
- **`.env.local` is production.** Every agent shares the same live database, Stripe
  and email. Don't run writes or sends to "test".
