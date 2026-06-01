# Capture operator-manual screenshots from local dev servers.
# Requires: agent-browser, API :3001, Keycloak :8080, admin-tenant :3002, admin-state :3003

$ErrorActionPreference = 'Stop'
$shotDir = (Join-Path $PSScriptRoot '..\docs\help\assets\screenshots' | Resolve-Path).Path

function Get-KcToken([string]$ClientId, [string]$Username) {
  $body = @{
    grant_type = 'password'
    client_id  = $ClientId
    username   = $Username
    password   = 'DummyDev_2026!ChangeMe'
  }
  (Invoke-RestMethod -Uri 'http://localhost:8080/realms/enagar/protocol/openid-connect/token' `
    -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded').access_token
}

function Invoke-BrowserJs([string]$Script) {
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
  agent-browser eval -b $b64
}

function Inject-AdminAuth([string]$StorageKey, [string]$Token) {
  $exp = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 3600
  $js = "sessionStorage.setItem('$StorageKey', JSON.stringify({access_token:'$Token',expires_at:$exp,api_base_url:'http://localhost:3001/api'}));"
  Invoke-BrowserJs $js | Out-Null
}

function Shot([string]$Name) {
  $path = Join-Path $shotDir "$Name.png"
  agent-browser screenshot --full $path
  if (-not (Test-Path $path)) { throw "Missing screenshot: $path" }
  Write-Host "Wrote $path ($((Get-Item $path).Length) bytes)"
}

agent-browser close --all 2>$null | Out-Null

# --- Tenant Admin (BMC) ---
$tenantToken = Get-KcToken 'admin-tenant' 'bmc-tenant-admin-dummy'
agent-browser open 'http://localhost:3002/login'
Start-Sleep -Seconds 1
Inject-AdminAuth 'enagar.admin.oauth' $tenantToken
agent-browser open 'http://localhost:3002/dashboard'
Start-Sleep -Seconds 5
Shot 'tenant-menu'

agent-browser open 'http://localhost:3002/dashboard/desk'
Start-Sleep -Seconds 4
Shot 'tenant-desk'

$svcResponse = Invoke-RestMethod -Uri 'http://localhost:3001/api/admin/tenant/services' `
  -Headers @{ Authorization = "Bearer $tenantToken" }
$svcList = @($svcResponse)
if ($svcResponse.PSObject.Properties.Name -contains 'value') {
  $svcList = @($svcResponse.value)
}
if (-not $svcList.Count) { throw 'No tenant services returned from API' }
$svcId = ($svcList | Where-Object { $_.code -eq 'trade-licence' } | Select-Object -First 1).id
if (-not $svcId) { $svcId = $svcList[0].id }
agent-browser open "http://localhost:3002/dashboard/services/$svcId"
Start-Sleep -Seconds 6
Shot 'tenant-form-builder'
Invoke-BrowserJs 'window.scrollBy(0, 1100);' | Out-Null
Start-Sleep -Seconds 2
Shot 'tenant-workflow'

# --- State Admin (OAuth — admin-state client has no password grant) ---
agent-browser open 'http://localhost:3003/api/admin-auth/start'
Start-Sleep -Seconds 2
agent-browser fill '@e4' 'bmc-state-admin-dummy'
agent-browser fill '@e2' 'DummyDev_2026!ChangeMe'
agent-browser click '@e6'
Start-Sleep -Seconds 6
Shot 'state-overview'

Invoke-BrowserJs @"
(() => {
  const el = [...document.querySelectorAll('button,a')].find(
    (n) => /municipalit/i.test((n.textContent || '').trim())
  );
  if (el) el.click();
})();
"@ | Out-Null
Start-Sleep -Seconds 3
Shot 'state-onboarding'

agent-browser close --all
Write-Host 'All screenshots captured.'
