# Synchronise le backend ET le frontend du projet desktop depuis le projet
# principal (../shopping-assistant). Les deux sont des COPIES ; ce script evite
# la derive quand le principal evolue.
#
# Backend : copie src/ + tests/, en EXCLUANT db.py (version SQLite specifique au
#   desktop). run_backend.py (desktop, absent du principal) n'est pas touche.
# Frontend : copie src/ + public/. vendor/types, next.config et les configs
#   locales du desktop sont preserves (hors src/).
#
# Apres sync : `npm run build:backend` et/ou `npm run build:web` selon les changements.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$mainRoot = Join-Path (Split-Path $root -Parent) 'shopping-assistant'
if (-not (Test-Path $mainRoot)) { throw "Projet principal introuvable : $mainRoot" }

$mainBackend = Join-Path $mainRoot 'services\scraping'
$mainWeb = Join-Path $mainRoot 'apps\web'

# --- Backend ---
robocopy "$mainBackend\src"   "$root\backend\src"   /E /XF db.py /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$mainBackend\tests" "$root\backend\tests" /E /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null

# --- Frontend (code source uniquement) ---
robocopy "$mainWeb\src"    "$root\web\src"    /E /XD node_modules .next /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$mainWeb\public" "$root\web\public" /E /NFL /NDL /NJH /NJS /NP | Out-Null

if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }

Write-Host "Desktop synchronise depuis : $mainRoot"
Write-Host "  backend/src + tests (db.py SQLite et run_backend.py preserves)"
Write-Host "  web/src + public (vendor/types et configs locales preserves)"
Write-Host "Pense a : npm run build:backend / build:web selon les changements."
