# Synchronise le backend ET le frontend du projet desktop depuis le projet
# principal (../shopping-assistant). Les deux sont des COPIES ; ce script evite
# la derive quand le principal evolue.
#
# Backend : copie src/ + tests/, en EXCLUANT db.py (version SQLite specifique au
#   desktop). run_backend.py (desktop, absent du principal) n'est pas touche.
# Frontend : copie src/ + public/, AINSI QUE les fichiers qui doivent refleter
#   le principal a l'identique (sources de derive recurrentes) :
#     - tailwind.config.js (design system commun)
#     - vendor/types/{src,dist} (types partages = packages/types du principal)
#   Seuls db.py, run_backend.py et next.config (specifiques desktop) sont preserves.
#
# Prerequis : builder les types du principal avant de sync si tu les as modifies
#   (`pnpm --filter @shopping-assistant/types build` dans le principal), sinon le
#   dist vendorise serait obsolete.
# Apres sync : `npm run build:backend` et/ou `npm run build:web` selon les changements.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$mainRoot = Join-Path (Split-Path $root -Parent) 'shopping-assistant'
if (-not (Test-Path $mainRoot)) { throw "Projet principal introuvable : $mainRoot" }

$mainBackend = Join-Path $mainRoot 'services\scraping'
$mainWeb = Join-Path $mainRoot 'apps\web'
$mainTypes = Join-Path $mainRoot 'packages\types'

# --- Backend ---
robocopy "$mainBackend\src"   "$root\backend\src"   /E /XF db.py /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$mainBackend\tests" "$root\backend\tests" /E /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null

# --- Frontend (code source uniquement) ---
robocopy "$mainWeb\src"    "$root\web\src"    /E /XD node_modules .next /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$mainWeb\public" "$root\web\public" /E /NFL /NDL /NJH /NJS /NP | Out-Null

# --- Configs/types partages (doivent etre identiques au principal) ---
Copy-Item "$mainWeb\tailwind.config.js" "$root\web\tailwind.config.js" -Force
robocopy "$mainTypes\src"  "$root\web\vendor\types\src"  /E /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$mainTypes\dist" "$root\web\vendor\types\dist" /E /NFL /NDL /NJH /NJS /NP | Out-Null

if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }

Write-Host "Desktop synchronise depuis : $mainRoot"
Write-Host "  backend/src + tests (db.py SQLite et run_backend.py preserves)"
Write-Host "  web/src + public + tailwind.config.js + vendor/types (auto)"
Write-Host "  (db.py, run_backend.py, next.config : preserves)"
Write-Host "Pense a : npm run build:backend / build:web selon les changements."
