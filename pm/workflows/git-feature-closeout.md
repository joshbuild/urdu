# Git — Feature Closeout
*v0.1 | 2026-06-18*

> **Escape-hatch only.** This project is trunk-based — work commits directly to `main`, so most features have *no branch to close*. This doc applies only when you used the rare branch/worktree escape hatch (`feature-lifecycle.md` § Escape hatch) for high-risk isolation or genuinely concurrent multi-agent work. For normal trunk-based close-out (status flip → archive → tombstone), see `feature-lifecycle.md` §5 — there is no merge step.

*Owns the **git moves** for closing an escape-hatch branch. `feature-lifecycle.md` owns the **doc/status moves** (gate checks, status flips, archiving, tombstoning). Both apply at close — read this for the commands, that for the ritual.*

## Paths

- **PR** — default. Any branch big enough to want review, a rollback boundary, or a descriptive merge.
- **Direct FF** — small self-contained fix on a short branch; skip the PR ceremony.
- When in doubt, PR.

## Preconditions

- On the feature branch; working tree clean; all intended changes committed.
- Branch's base is `main` — if not, stop and read `feature-lifecycle.md`.
- Feature-lifecycle gate passed (status/sign-off live there, not here).
- Branch already pushed to `origin` (or accept that `gh pr create` will push it on Path A).
- Path A also needs `gh` authenticated against the GitHub remote.

## Path A — PR

```
git status                            # clean working tree
git fetch origin
git log --oneline origin/main..HEAD   # exactly the commits the PR will carry

git rebase origin/main                # optional; cleaner merge, no merge commit
git push --force-with-lease           # only if the rebase rewrote anything

gh pr create --base main --fill       # --fill seeds title/body from commits
gh pr view --web
```

PR body: *what*, *why*, *how tested*, *risks/follow-ups*.

Squash-merge gotcha: GitHub's squash makes a new commit on `main` that git doesn't see as the branch's merge ancestor — `branch -d` will refuse. Verify the squash landed (`git log --oneline main | head`), then use `-D`.

After GitHub merges → Path C.

## Path B — Direct FF into main

```
git fetch origin
git rebase origin/main                # branch ends up directly ahead of main

git switch main
git pull --ff-only
git merge --ff-only <branch>          # fails if branch isn't directly ahead — rebase branch, retry
git push
```

`--ff-only` everywhere: refuses silent merge commits. Linear history.

After merge → Path C.

## Path C — Teardown

```
git switch main
git pull --ff-only                    # fast-forward main to include the merge
git branch -d <branch>                # -d refuses unmerged work (safety); -D only after verifying squash
git push origin --delete <branch>     # don't leave dead branches on the remote
git fetch --prune                     # drop the stale origin/<branch> ref
git branch -a                         # confirm clean
```

Worktree escape hatch (only if you used one):
```
git worktree remove ../<repo>-<slug>
git worktree list                     # confirm clean
```

## Don'ts

- `--force` — always `--force-with-lease`.
- Plain `pull` — `--ff-only` refuses silent merge commits.
- Rebase a branch others may have based work on. Merge `main` *in* instead, or coordinate.
