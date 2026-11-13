#!/bin/sh
# Run console lines against the real command table and tree before giving them to anyone, one line per argument:
#   tools/consolePath.sh 'lane.kids on' 'tp me 105 -17' 'tp me to barn' 'mist vauclair' weather.time
# ok or NO for each, with the reason. A folder prints what is inside it. The game behind it is a stand-in (tests/consolePaths.test.js says
# what it knows): paths under `vehicle.<id>` and `girl.<name>` can't be checked this way, so read gameTree.js for those.
set -eu
cd "$(dirname "$0")/.."
CONSOLE_LINES=$(printf '%s\n' "$@") npx vitest run tests/consolePaths.test.js 2>&1 | grep -E '^(ok|NO|skip) '
