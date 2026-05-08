# UBID Platform — Windows Setup Script
# Run from repo root: .\setup-windows.ps1
# Requires: Python 3.12 (see instructions below)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  UBID Platform — Windows Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check Python 3.12 ────────────────────────────────────────────────
Write-Host "[1/7] Checking Python version..." -ForegroundColor Yellow

$py312 = $null
# Try py launcher first
try { $py312 = (py -3.12 --version 2>&1) } catch {}
if ($py312 -match "3\.12") {
    Write-Host "  Found Python 3.12 via py launcher." -ForegroundColor Green
    $pythonCmd = "py -3.12"
} elseif ((python --version 2>&1) -match "3\.12") {
    Write-Host "  Found Python 3.12 as default python." -ForegroundColor Green
    $pythonCmd = "python"
} else {
    Write-Host ""
    Write-Host "  ERROR: Python 3.12 not found." -ForegroundColor Red
    Write-Host "  Your current Python is 3.14 which lacks binary wheels for asyncpg/pydantic." -ForegroundColor Red
    Write-Host ""
    Write-Host "  FIX (5 minutes):" -ForegroundColor Yellow
    Write-Host "  1. Open: https://www.python.org/downloads/release/python-3129/" -ForegroundColor White
    Write-Host "  2. Download: Windows installer (64-bit)" -ForegroundColor White
    Write-Host "  3. Install it — check 'Add to PATH', click Install Now" -ForegroundColor White
    Write-Host "  4. Close this window, open a new PowerShell, run this script again" -ForegroundColor White
    Write-Host ""
    exit 1
}

# ── Step 2: Create virtual environment ──────────────────────────────────────
Write-Host "[2/7] Creating virtual environment (.venv)..." -ForegroundColor Yellow
if (Test-Path ".venv") {
    Write-Host "  .venv already exists, skipping." -ForegroundColor Gray
} else {
    Invoke-Expression "$pythonCmd -m venv .venv"
    Write-Host "  Virtual environment created." -ForegroundColor Green
}

# Activate venv
$activateScript = Join-Path $root ".venv\Scripts\Activate.ps1"
. $activateScript
Write-Host "  Virtual environment activated." -ForegroundColor Green

# ── Step 3: Install dependencies ─────────────────────────────────────────────
Write-Host "[3/7] Installing Python dependencies..." -ForegroundColor Yellow
pip install -r backend\requirements.txt --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "  pip install failed. See error above." -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies installed." -ForegroundColor Green

# ── Step 4: Generate synthetic data ──────────────────────────────────────────
Write-Host "[4/7] Generating synthetic data..." -ForegroundColor Yellow
Set-Location $root
python scripts\generate_synthetic_data.py
Write-Host "  Data generated." -ForegroundColor Green

# ── Step 5: Seed database ─────────────────────────────────────────────────────
Write-Host "[5/7] Seeding database (schema + users + departments)..." -ForegroundColor Yellow
python scripts\seed_db.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Seed failed. Check your .env DATABASE_URL and internet connection." -ForegroundColor Red
    exit 1
}

# ── Step 6: Ingest data ───────────────────────────────────────────────────────
Write-Host "[6/7] Ingesting department records..." -ForegroundColor Yellow
python scripts\ingest.py
Write-Host "  Ingestion complete." -ForegroundColor Green

# ── Step 7: Summary ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Now open TWO more PowerShell windows:" -ForegroundColor White
Write-Host ""
Write-Host "  TERMINAL 1 — API:" -ForegroundColor Yellow
Write-Host "    cd '$root'" -ForegroundColor Gray
Write-Host "    .\.venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "    cd backend" -ForegroundColor Gray
Write-Host "    uvicorn app.main:app --reload --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "  TERMINAL 2 — Frontend:" -ForegroundColor Yellow
Write-Host "    cd '$root\frontend'" -ForegroundColor Gray
Write-Host "    npm install" -ForegroundColor Gray
Write-Host "    npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  App:      http://localhost:3000" -ForegroundColor Cyan
Write-Host "  API docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
