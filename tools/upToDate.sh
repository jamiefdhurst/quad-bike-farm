#!/bin/sh
# Whether the main checkout is up to date with origin/main. Slash commands (/todo, /tidy, /perf) are read from it, so a checkout that is
# behind runs old rules without anyone noticing (#721). Never pulls or switches branch: other sessions work in that checkout.
#
#   tools/upToDate.sh    prints "ok", or how far behind and the line to pull with (exit 1)
set -eu

main=$(git rev-parse --path-format=absolute --git-common-dir | sed 's|/\.git$||')
git -C "$main" fetch -q origin main
behind=$(git -C "$main" rev-list --count HEAD..origin/main)
if [ "$behind" -gt 0 ]; then
  echo "The main checkout ($main) is $behind commits behind origin/main, so the slash commands are out of date."
  echo "Jamie, please run:  ! git -C $main pull --ff-only"
  exit 1
fi
echo ok
