<#
  Staff-First Booking — one-shot local setup (Windows / PowerShell)
  Run this on a machine WITH unrestricted internet access.

  It will:
   1. Check Node version
   2. Install npm dependencies
   3. Install the Shopify CLI globally (if missing)
   4. Ensure .env exists
   5. Generate the Prisma client + push the schema
   6. Run the availability-engine unit tests
   7. Print the exact next commands

  Usage:  .\setup.ps1
  Skip checks you already did:  .\setup.ps1 -SkipCli -SkipTests
#>
param(
  [switch]$SkipCli,
  [switch]$SkipDb,
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
function Step($n, $msg) { Write-Host "`n=== [$n] $msg ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  !   $msg" -ForegroundColor Yellow }

# 1. Node version
Step 1 "Checking Node.js"
try {
  $v = (node --version) -replace '^v',''
  $major = [int]($v.Split('.')[0])
  if ($major -lt 20) { throw "Node $v found, need >= 20.10" }
  Ok "Node v$v"
} catch {
  Write-Host "Node.js is required (>= 20.10). Install from https://nodejs.org" -ForegroundColor Red
  exit 1
}

# 2. npm dependencies
Step 2 "Installing npm dependencies (this can take a few minutes)"
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
Ok "Dependencies installed"

# 3. Shopify CLI
if (-not $SkipCli) {
  Step 3 "Checking Shopify CLI"
  $shopify = Get-Command shopify -ErrorAction SilentlyContinue
  if (-not $shopify) {
    Warn "Shopify CLI not found — installing globally"
    npm install -g @shopify/cli@latest --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw "Shopify CLI install failed" }
  }
  Ok "Shopify CLI: $((shopify version) 2>$null)"
} else { Step 3 "Skipping Shopify CLI (as requested)" }

# 4. .env
Step 4 "Checking environment file"
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Warn ".env created from .env.example — EDIT DATABASE_URL before continuing."
  Write-Host "     You need a PostgreSQL URL (e.g. free Neon: https://neon.tech)" -ForegroundColor Yellow
  Write-Host "     Edit .env now, then re-run this script." -ForegroundColor Yellow
  exit 0
} else {
  Ok ".env present"
}

# 5. Prisma
if (-not $SkipDb) {
  Step 5 "Generating Prisma client + pushing schema"
  npx prisma generate
  if ($LASTEXITCODE -ne 0) { throw "prisma generate failed" }
  Ok "Prisma client generated"

  # Check DATABASE_URL is not the placeholder
  $envContent = Get-Content ".env" -Raw
  if ($envContent -match 'DATABASE_URL\s*=\s*"?postgresql://user:password') {
    Warn "DATABASE_URL still has the placeholder value — skipping db push."
    Write-Host "     Set a real PostgreSQL URL in .env, then run: npx prisma db push" -ForegroundColor Yellow
  } else {
    npx prisma db push
    if ($LASTEXITCODE -ne 0) { Warn "prisma db push failed — check DATABASE_URL reachability" }
    else { Ok "Database schema pushed" }
  }
} else { Step 5 "Skipping database (as requested)" }

# 6. Tests
if (-not $SkipTests) {
  Step 6 "Running availability-engine unit tests"
  npm test
  if ($LASTEXITCODE -ne 0) { Warn "Some tests failed — review output above" }
  else { Ok "All availability tests passed" }
} else { Step 6 "Skipping tests (as requested)" }

# 7. Next steps
Step 7 "Next steps"
Write-Host @"
  1) Link to your Shopify Partner account (fills API key/secret):
       shopify app config link
  2) Start the dev server + tunnel:
       shopify app dev
  3) In the opened app, press 'p' to open it in your dev store.
  4) Add the "Choose your staff" app block in the theme editor (product template).
"@ -ForegroundColor White
Write-Host "`nSetup complete." -ForegroundColor Green
