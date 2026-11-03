#!/bin/sh
# Check console paths against the real tree before giving them to anyone: tools/consolePath.sh lane.kids village.shop weather.time
# A folder prints what is inside it. Paths under `vehicle.<id>` and `girl.<name>` can't be checked this way (the stand-in has no vehicles): read gameTree.js.
# Vehicle verbs (`mist p309`) and `tp` places are not paths: see `help` and `places` in the console.
set -eu
cd "$(dirname "$0")/.."
CONSOLE_PATHS="$*" npx vitest run tests/consolePaths.test.js 2>&1 | grep -E '^(ok|NO) '
