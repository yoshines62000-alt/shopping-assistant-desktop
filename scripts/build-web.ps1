# Build le frontend Next.js en mode "standalone" -> resources/web (serveur node
# autonome, lance par le node embarque d'Electron). NEXT_PUBLIC_API_URL est
# fige a la build (port backend fixe 8756) car les variables NEXT_PUBLIC sont
# inlinees au build.
#
# Assemble la sortie : Next ne copie PAS .next/static ni public dans standalone,
# il faut le faire a la main.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$web = Join-Path $root 'web'
$dst = Join-Path $root 'resources\web'

Push-Location $web
try {
  $env:BUILD_STANDALONE = '1'
  $env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8756'
  npx next build
  if ($LASTEXITCODE -ne 0) { throw "next build a echoue (code $LASTEXITCODE)" }
} finally {
  Pop-Location
}

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Item "$web\.next\standalone\*" $dst -Recurse -Force
New-Item -ItemType Directory -Force (Join-Path $dst '.next\static') | Out-Null
Copy-Item "$web\.next\static\*" (Join-Path $dst '.next\static') -Recurse -Force
if (Test-Path "$web\public") {
  Copy-Item "$web\public" (Join-Path $dst 'public') -Recurse -Force
}
Write-Host "OK -> $dst"
