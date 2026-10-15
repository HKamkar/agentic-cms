#!/usr/bin/env bash
# Sets up a clone of this site for development, on a laptop or a VM, for a
# person or an agent (Claude Code, Codex). The steps a package cannot do for
# itself: Node checked, pnpm at the version package.json pins, the
# dependencies installed. Then `agentic-cms setup` does the rest: the
# browsers the kit drives (Chromium, WebKit), .env.local with this machine's
# addresses in ALLOWED_DEV_ORIGINS, the lint and the tests, the URLs. Safe to
# run again: every step keeps what is already there.
#
#   bash scripts/setup.sh              # everything, then lint and test
#   bash scripts/setup.sh --build      # also the production build
#   bash scripts/setup.sh --deps       # also WebKit's Linux libraries (sudo)
#   bash scripts/setup.sh --check      # what is missing; changes nothing after the install
#
# The flags are agentic-cms setup's (pnpm exec agentic-cms setup --help).
# There is no package script named setup: `pnpm setup` is pnpm's own command.
# node_modules/agentic-cms/docs/setup.md says what each step is for and what
# to do when one fails.
set -euo pipefail
cd "$(dirname "$0")/.."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

fail() { printf '✗ %s\n' "$*" >&2; exit 2; }

command -v node >/dev/null || fail "Node is not installed: install the version .nvmrc names (nvm install, fnm install, or nodejs.org), then run this again"
NODE_VERSION=$(node -p process.versions.node)
IFS=. read -r MAJOR MINOR _ <<<"$NODE_VERSION"
if (( MAJOR < 22 || (MAJOR == 22 && MINOR < 18) )); then
  fail "Node $NODE_VERSION is too old: the site needs 22.18 or newer (.nvmrc names the one to use)"
fi
printf '✓ Node %s\n' "$NODE_VERSION"

PNPM_VERSION=$(node -p '(require("./package.json").packageManager ?? "").match(/^pnpm@([^+]+)/)?.[1] ?? ""')
if ! command -v pnpm >/dev/null; then
  # Node 25 and later ship no corepack: npm installs the pinned pnpm instead.
  if command -v corepack >/dev/null && corepack enable pnpm 2>/dev/null && command -v pnpm >/dev/null; then
    printf '✓ pnpm enabled through corepack\n'
  else
    npm install -g "pnpm@${PNPM_VERSION:-latest}" \
      || fail "could not install pnpm: run 'npm install -g pnpm@${PNPM_VERSION:-latest}' (with sudo if npm's global folder needs it), then run this again"
  fi
  command -v pnpm >/dev/null || fail "pnpm is installed but not on PATH: open a new shell, then run this again"
fi
printf '✓ pnpm %s%s\n' "$(pnpm --version)" "${PNPM_VERSION:+ (package.json pins $PNPM_VERSION)}"

# A fresh site from init has no lockfile yet: the first install writes it (commit it).
if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

exec pnpm exec agentic-cms setup "$@"
