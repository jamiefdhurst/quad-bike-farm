#!/bin/sh
# The frame budget history (tools/budgetHistory.mjs) from the newest run on main that kept one, written to <out>, or [] when there is none.
# The Release workflow records it (#636); before that perf-history.yml did, so its runs are looked at too until their artifacts expire.
# A release whose measuring failed has no artifact, so this goes back through the last few runs rather than taking only the newest.
#   GH_TOKEN=... tools/fetchBudgetHistory.sh history.json
set -u
out=${1:?usage: tools/fetchBudgetHistory.sh <out.json>}
tmp=$(mktemp -d)
for wf in release.yml perf-history.yml; do
  for run in $(gh run list --workflow "$wf" --branch main --status success --limit 10 --json databaseId --jq '.[].databaseId' 2>/dev/null); do
    if gh run download "$run" -n budget-history -D "$tmp/$run" >/dev/null 2>&1 && [ -f "$tmp/$run/history.json" ]; then
      cp "$tmp/$run/history.json" "$out"
      echo "budget history from run $run ($wf)"
      rm -rf "$tmp"
      exit 0
    fi
  done
done
rm -rf "$tmp"
echo '[]' > "$out"
echo 'no budget history yet'
