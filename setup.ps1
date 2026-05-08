# UBID Platform — Full Setup Script for PowerShell 5.1
# Run from: C:\Users\DELL\Downloads\AI for Bharat\ubid-platform\
# Usage: .\setup.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "`n[1/6] Starting PostgreSQL + Redis via Docker..." -ForegroundColor Cyan
Set-Location "$root\infra"
docker compose up -d
if (-not $?) { Write-Error "Docker failed. Is Docker Desktop running?"; exit 1 }
Write-Host "  Docker containers started." -ForegroundColor Green

Write-Host "`n[2/6] Installing Python dependencies..." -ForegroundColor Cyan
Set-Location $root
pip install -r backend\requirements.txt
if (-not $?) { Write-Error "pip install failed"; exit 1 }
Write-Host "  Python deps installed." -ForegroundColor Green

Write-Host "`n[3/6] Copying .env file..." -ForegroundColor Cyan
if (-not (Test-Path "$root\.env")) {
    Copy-Item "$root\.env.example" "$root\.env"
    Write-Host "  .env created from .env.example" -ForegroundColor Green
} else {
    Write-Host "  .env already exists, skipping." -ForegroundColor Yellow
}

Write-Host "`n[4/6] Generating synthetic data..." -ForegroundColor Cyan
Set-Location $root
python scripts\generate_synthetic_data.py
Write-Host "  Synthetic data generated." -ForegroundColor Green

Write-Host "`n[5/6] Seeding database..." -ForegroundColor Cyan
python scripts\seed_db.py
Write-Host "  Database seeded." -ForegroundColor Green

Write-Host "`n[6/6] Running ingestion pipeline..." -ForegroundColor Cyan
python scripts\ingest.py
Write-Host "  Ingestion complete." -ForegroundColor Green

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " Setup complete!" -ForegroundColor Green
Write-Host " Now open TWO more terminals and run:" -ForegroundColor White
Write-Host ""
Write-Host "   Terminal 1 (API):" -ForegroundColor Yellow
Write-Host "   cd '$root\backend'" -ForegroundColor Gray
Write-Host "   uvicorn app.main:app --reload --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "   Terminal 2 (Frontend):" -ForegroundColor Yellow
Write-Host "   cd '$root\frontend'" -ForegroundColor Gray
Write-Host "   npm install" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "   App:      http://localhost:3000" -ForegroundColor Green
Write-Host "   API docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
