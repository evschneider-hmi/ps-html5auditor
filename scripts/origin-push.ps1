Param(
  [Parameter(Mandatory=$false)][string]$Branch = "main",
  [switch]$Deprecated
)
# NOTE: This script has been repurposed for the canonical repo at evschneider-hmi/ps-html5auditor.
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

$remoteUrl = "https://github.com/evschneider-hmi/ps-html5auditor.git"
Write-Host "Pushing branch $Branch to canonical repo (token stored via credential helper)" -ForegroundColor Yellow

# Stage the PAT with git's credential helper so it never appears in a remote URL or on disk.
$credentialInput = @"
protocol=https
host=github.com
username=evschneider-hmi
password=$plain
"@
$credentialRejectInput = @"
protocol=https
host=github.com
username=evschneider-hmi
"@

$credentialPrepared = $false
try {
  $credentialInput | git credential approve | Out-Null
  $credentialPrepared = $true

  git push $remoteUrl $Branch:main
  if ($LASTEXITCODE -ne 0) { throw "Push failed" }
  Write-Host "Push succeeded." -ForegroundColor Green
} catch {
  if (-not $credentialPrepared) {
    Write-Error "Failed to register credentials with git credential helper: $_"
    exit 4
  }
  Write-Error $_
  exit 3
} finally {
  if ($credentialPrepared) {
    $credentialRejectInput | git credential reject | Out-Null
  }
  Remove-Variable plain -ErrorAction SilentlyContinue
  if ($token -is [System.IDisposable]) {
    $token.Dispose()
  }
  Remove-Variable token -ErrorAction SilentlyContinue
}
