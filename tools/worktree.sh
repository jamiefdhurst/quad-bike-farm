#!/bin/sh
# A worktree per GitHub issue, so sessions working in parallel never switch each other's branch (docs/decisions/process.md, "Issues, pull
# requests and releases"). Worktrees live beside the main checkout, not inside it, so the dev server there doesn't watch them.
#
#   tools/worktree.sh start <issue>    branch issue-<n>-<slug> from origin/main, print the worktree's path
#   tools/worktree.sh path <issue>     print the path of an issue's worktree
#   tools/worktree.sh finish <issue>   remove the worktree and its local branch (after the PR has merged)
set -eu

main=$(git rev-parse --path-format=absolute --git-common-dir | sed 's|/\.git$||')
base="$(dirname "$main")/$(basename "$main")-worktrees"
cmd=${1:-}
issue=${2:-}
[ -n "$cmd" ] && [ -n "$issue" ] || { echo "usage: tools/worktree.sh start|path|finish <issue number>" >&2; exit 2; }
dir="$base/issue-$issue"

case "$cmd" in
  start)
    if [ -d "$dir" ]; then echo "$dir"; exit 0; fi
    title=$(gh issue view "$issue" --json title --jq .title)
    slug=$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//' | cut -c1-40 | sed 's/-$//')
    git -C "$main" fetch -q origin main
    mkdir -p "$base"
    git -C "$main" worktree add -q -b "issue-$issue-$slug" "$dir" origin/main
    # Shared with the main checkout: the installed packages, and .scratch (voice cache and venvs, headless scripts).
    # If the item changes package.json, replace the node_modules link with a real `npm ci` in the worktree.
    ln -s "$main/node_modules" "$dir/node_modules"
    ln -s "$main/.scratch" "$dir/.scratch"
    echo "$dir"
    ;;
  path)
    echo "$dir"
    ;;
  finish)
    branch=$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
    git -C "$main" worktree remove --force "$dir"
    [ -n "$branch" ] && git -C "$main" branch -D "$branch" >/dev/null 2>&1 || true
    git -C "$main" worktree prune
    ;;
  *)
    echo "unknown command: $cmd" >&2; exit 2
    ;;
esac
