# Synchronise le backend du projet desktop depuis le projet principal
# (../shopping-assistant). Le backend desktop est une COPIE adaptee ; ce script
# evite la derive quand le backend principal evolue (scraping, routes...).
#
# Copie src/ et tests/ depuis le principal, en EXCLUANT :
#   - db.py : version SQLite specifique au desktop (le principal est en Postgres),
#   - les __pycache__.
# run_backend.py (desktop) n'est pas touche (absent du principal).
#
# Apres sync : verifier puis `npm run build:backend` pour embarquer les changements.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$main = Join-Path (Split-Path $root -Parent) 'shopping-assistant\services\scraping'
if (-not (Test-Path $main)) { throw "Projet principal introuvable : $main" }
$dst = Join-Path $root 'backend'

robocopy "$main\src"   "$dst\src"   /E /XF db.py /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$main\tests" "$dst\tests" /E /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }

Write-Host "Backend desktop synchronise depuis :"
Write-Host "  $main"
Write-Host "(db.py SQLite et run_backend.py preserves)"
Write-Host "Pense a : npm run build:backend  (pour embarquer les changements)"
