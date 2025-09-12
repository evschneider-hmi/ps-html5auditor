<#
mirror-push.ps1

Interactive helper to push this repository to a target GitHub repo using a PAT
without permanently storing the token.

Usage:
  .\scripts\mirror-push.ps1
  # or specify repo/branch/force
  .\scripts\mirror-push.ps1 -RemoteRepo "https://github.com/evschneider-hmi/ps-html5auditor.git" -Branch main -Force

What it does:
- Prompts securely for a PAT (classic or fine-grained) and does not save it.
- Tests the PAT against the target repo REST API.
- Adds a temporary remote, performs the push, and removes the remote.
- Exits with non-zero on any error.

Notes:
- Prefer a classic PAT with `repo` scope for simplicity. If using a fine-grained PAT,
  ensure it has read & write access to the target repo.
- If your org uses SAML SSO, authorize the token for the organization before using it.
#>

[CmdletBinding()]
param(
    [string]$RemoteRepo = "https://github.com/evschneider-hmi/ps-html5auditor.git",
    [string]$Branch = "main",
    [switch]$Force
)

function ConvertFrom-SecureStringToPlain {
    param (
        [Parameter(Mandatory=$true)] [System.Security.SecureString] $Secure
    )
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

Write-Host "Mirror push helper"

$secure = Read-Host -Prompt 'Paste CLASSIC PAT or fine-grained PAT for target account (won''t be saved to disk)' -AsSecureString
$token = ConvertFrom-SecureStringToPlain -Secure $secure
if (-not $token -or $token.Trim() -eq '') {
    Write-Error "No token entered. Exiting."
    exit 1
}

# Basic token length check
if ($token.Length -lt 20) {
    Write-Warning "Token length looks short (${token.Length}). Verify you pasted the full token."
}

Write-Host "Validating token against $RemoteRepo ..."
# Derive API URL from repo URL
if ($RemoteRepo -match 'github.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)') {
    $owner = $Matches['owner']; $repo = $Matches['repo']
    $apiUrl = "https://api.github.com/repos/$owner/$repo"
} else {
    Write-Error "Cannot parse remote repository from $RemoteRepo"
    exit 2
}

try {
    $resp = Invoke-RestMethod -Headers @{ Authorization = "Bearer $token"; 'User-Agent' = 'mirror-push-script' } -Method GET -Uri $apiUrl -ErrorAction Stop
    Write-Host "API validation OK: repository found -> $($resp.full_name)"
} catch {
    Write-Error "API validation failed: $($_.Exception.Message)"
    Write-Host "Common causes: token lacks repo scope, token requires SSO authorization, token expired, or repo not visible to token."
    exit 3
}

# Prepare temporary remote
$remoteName = 'hmi-mirror-temp'
if (git remote | Select-String -Pattern "^$remoteName$" -Quiet) {
    git remote remove $remoteName
}

# Use x-access-token URL which is safe for GitHub
$pushUrl = $RemoteRepo
# Build a URL that contains credential; we won't log it and we'll remove remote after push
# It's acceptable for a one-off local action; prefer using GH CLI if available for long term.
$authUrl = $pushUrl -replace '^https://', "https://x-access-token:$token@"

try {
    git remote add $remoteName $authUrl
} catch {
    Write-Error "Failed to add remote: $($_.Exception.Message)"
    exit 4
}

# Construct push args
$pushRef = "HEAD:$Branch"
if ($Force) { $pushArgs = @('--force', $pushRef) } else { $pushArgs = @($pushRef) }

Write-Host "Pushing to $RemoteRepo (branch $Branch) ..."
try {
    & git push $remoteName @pushArgs
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "git push returned exit code $code" }
    Write-Host "Push succeeded."
} catch {
    Write-Error "Push failed: $($_.Exception.Message)"
    Write-Host "If this is a permission error, ensure the PAT has repo write, is authorized for org SSO (if used), and that branch protections allow the push."
    # cleanup remote before exit
    git remote remove $remoteName
    exit 5
}

# Cleanup: remove temporary remote
git remote remove $remoteName

# Zero out token from memory
$token = $null
[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()

Write-Host "Mirror push complete. Verify target repo: $RemoteRepo"
exit 0
