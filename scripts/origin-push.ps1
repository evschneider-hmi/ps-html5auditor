Param(
  [Parameter(Mandatory=$false)][string]$Branch = "main"
)
Write-Host "== Origin Push Helper ==" -ForegroundColor Cyan

if (-not (Test-Path .git)) { Write-Error "Run from repo root"; exit 1 }

$token = Read-Host -AsSecureString "Enter PAT for account evan-schneider (repo scope)"
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
if (-not $plain -or $plain.Length -lt 30) { Write-Error "Token length suspicious"; exit 2 }

$remoteUrl = "https://$plain@github.com/evan-schneider/html5-audit-tool.git"
Write-Host "Pushing branch $Branch to origin (masked token)" -ForegroundColor Yellow

# Use a temporary remote to avoid storing token in config
$tempRemote = "origin-temp-token"
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
