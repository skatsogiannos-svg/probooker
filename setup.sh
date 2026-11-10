#!/usr/bin/env bash
# Staff-First Booking — one-shot local setup (macOS / Linux / WSL)
# Run on a machine WITH unrestricted internet access.
set -euo pipefail

SKIP_CLI=0; SKIP_DB=0; SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --skip-cli) SKIP_CLI=1 ;;
    --skip-db) SKIP_DB=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
  esac
done

cyan() { printf "\n\033[36m=== %s ===\033[0m\n" "$1"; }
ok()   { printf "  \033[32mOK\033[0m  %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m   %s\n" "$1"; }

cyan "1. Checking Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (>= 20.10). Install from https://nodejs.org"; exit 1
fi
NODE_MAJOR=$(node --version | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node $(node --version) found, need >= 20.10"; exit 1
fi
ok "Node $(node --version)"

cyan "2. Installing npm dependencies"
npm install --no-fund --no-audit
ok "Dependencies installed"

if [ "$SKIP_CLI" -eq 0 ]; then
  cyan "3. Checking Shopify CLI"
  if ! command -v shopify >/dev/null 2>&1; then
    warn "Shopify CLI not found — installing globally"
    npm install -g @shopify/cli@latest --no-fund --no-audit
  fi
  ok "Shopify CLI available"
else
  cyan "3. Skipping Shopify CLI (requested)"
fi

cyan "4. Checking environment file"
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env created — EDIT DATABASE_URL before continuing (e.g. Neon free tier)."
  echo "     Then re-run: ./setup.sh"
  exit 0
fi
ok ".env present"

if [ "$SKIP_DB" -eq 0 ]; then
  cyan "5. Generating Prisma client + pushing schema"
  npx prisma generate
  ok "Prisma client generated"
  if grep -q 'postgresql://user:password' .env; then
    warn "DATABASE_URL placeholder found — skipping db push. Edit .env, then: npx prisma db push"
  else
    npx prisma db push || warn "prisma db push failed — check DATABASE_URL"
    ok "Database check done"
  fi
else
  cyan "5. Skipping database (requested)"
fi

if [ "$SKIP_TESTS" -eq 0 ]; then
  cyan "6. Running availability-engine unit tests"
  npm test || warn "Some tests failed — review output above"
  ok "Tests done"
else
  cyan "6. Skipping tests (requested)"
fi

cyan "7. Next steps"
cat <<'EOF'

  1) Link to your Shopify Partner account:
       shopify app config link
  2) Start the dev server + tunnel:
       shopify app dev
  3) Press 'p' in the terminal to open the app in your dev store.
  4) Add the "Choose your staff" app block in the theme editor (product template).
EOF
printf "\n\033[32mSetup complete.\033[0m\n"
