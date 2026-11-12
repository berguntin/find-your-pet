#!/usr/bin/env bash
# PostToolUse: when Claude creates a PR with `gh pr create`, ask it to run the review.
# Claude Code sends the tool call's JSON on stdin.
input="$(cat)"

if printf '%s' "$input" | grep -q 'gh pr create'; then
  echo "You just created a PR. Now run /senior-code-reviewer passing only the branch range against its base, without summarizing what you implemented. If the verdict is BLOCK or CHANGES REQUIRED, fix the findings before considering the task done." >&2
  exit 2   # in PostToolUse, exit code 2 makes Claude read the stderr message
fi

exit 0
