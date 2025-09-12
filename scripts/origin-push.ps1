Param(
  [Parameter(Mandatory=$false)][string]$Branch = "main",
  [switch]$Deprecated
)
# NOTE: This script has been repurposed. The original "origin" (evan-schneider/html5-audit-tool) is no longer used.
# It now targets the canonical repo under evschneider-hmi: ps-html5auditor.
# Use:  powershell -ExecutionPolicy Bypass -File .\scripts\origin-push.ps1 -Branch main
# Pass -Deprecated to only print a warning without pushing.

Write-Host "== Canonical Push Helper (HMI) ==" -ForegroundColor Cyan

if (-not (Test-Path .git)) { Write-Error "Run from repo root"; exit 1 }

if ($Deprecated) {
  Write-Warning "Deprecated mode: no push performed. This script now targets evschneider-hmi/ps-html5auditor."
  exit 0
}

$token = Read-Host -AsSecureString "Enter PAT for account evschneider-hmi (repo scope incl. workflow if editing workflows)"
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
if (-not $plain -or $plain.Length -lt 30) { Write-Error "Token length suspicious"; exit 2 }

$remoteUrl = "https://$plain@github.com/evschneider-hmi/ps-html5auditor.git"
Write-Host "Pushing branch $Branch to canonical repo (masked token)" -ForegroundColor Yellow

# Use a temporary remote to avoid storing token in config
$tempRemote = "hmi-temp-token"
if (git remote | Select-String -Pattern "^$tempRemote$") { git remote remove $tempRemote | Out-Null }

git remote add $tempRemote $remoteUrl
try {
  git push $tempRemote $Branch:main
  if ($LASTEXITCODE -ne 0) { throw "Push failed" }
  Write-Host "Push succeeded." -ForegroundColor Green
} catch {
  Write-Error $_
  exit 3
} finally {
  git remote remove $tempRemote | Out-Null
}
