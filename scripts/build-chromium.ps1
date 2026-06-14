# Telecharge le navigateur Chromium dans resources/chromium pour que le scraping
# fonctionne dans l'app packagee SANS dependre du Playwright global.
#
# On installe UNIQUEMENT "chromium-headless-shell" : le scraper tourne en
# headless=True, qui sous Playwright >=1.49 utilise le binaire "headless shell"
# (~270 Mo) et non le Chromium complet (~410 Mo). La revision installee
# correspond automatiquement a la version du package playwright.
#
# Prerequis : python + playwright installes.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dst = Join-Path $root 'resources\chromium'
New-Item -ItemType Directory -Force $dst | Out-Null

$env:PLAYWRIGHT_BROWSERS_PATH = $dst
Push-Location (Join-Path $root 'backend')
try {
  python -m playwright install chromium-headless-shell
  if ($LASTEXITCODE -ne 0) { throw "playwright install a echoue (code $LASTEXITCODE)" }
  # ffmpeg sert a l'enregistrement video, inutile au scraping : on l'enleve.
  Get-ChildItem $dst -Directory -Filter 'ffmpeg*' -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force
  Write-Host "OK -> $dst (chromium headless shell)"
} finally {
  Pop-Location
}
