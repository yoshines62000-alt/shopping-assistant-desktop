# Build le backend FastAPI en executable autonome via PyInstaller.
#
# Sortie : resources/backend/backend.exe (+ dependances), pret a etre embarque
# par electron-builder (jalon packaging). Le binaire ne depend plus du Python
# global ; il embarque uvicorn, FastAPI, SQLModel, le package src/ et Playwright
# (le navigateur Chromium, lui, est gere separement -- voir PLAN.md jalon 3).
#
# Prerequis : python + deps backend installes + `pip install pyinstaller`.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$resources = Join-Path $root 'resources'

Push-Location (Join-Path $root 'backend')
try {
  python -m PyInstaller --noconfirm --onedir --name backend `
    --distpath  $resources `
    --workpath  (Join-Path $root 'build_pyi') `
    --specpath  (Join-Path $root 'build_pyi') `
    --collect-all playwright `
    --collect-submodules uvicorn `
    --collect-submodules src `
    --add-data "src/db/migrations;src/db/migrations" `
    run_backend.py
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller a echoue (code $LASTEXITCODE)" }
  Write-Host "OK -> $(Join-Path $resources 'backend\backend.exe')"
} finally {
  Pop-Location
}
