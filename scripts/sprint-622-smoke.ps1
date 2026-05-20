# Sprint 6.22 live API smoke. Requires API :3001, Keycloak :8080, DEV_AUTH_ENABLED, db seeded.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3001/api'
$kc = 'http://localhost:8080/realms/enagar/protocol/openid-connect/token'
$mobile = '9836177767'
$categoryCode = 'noise-pollution'
$subtypeCode = 'construction-noise'
$kcPassword = if ($env:KEYCLOAK_DUMMY_USER_PASSWORD) { $env:KEYCLOAK_DUMMY_USER_PASSWORD } else { 'DummyDev_2026!ChangeMe' }

function Get-AdminToken {
  $body = @{
    grant_type = 'password'
    client_id  = 'admin-tenant'
    username   = 'kmc-municipality-admin-dummy'
    password   = $kcPassword
  }
  try {
    $r = Invoke-RestMethod -Method Post -Uri $kc -Body $body -ContentType 'application/x-www-form-urlencoded'
    return $r.access_token
  } catch {
    throw "Keycloak token failed (is infra up? pnpm infra:up && pnpm infra:seed-keycloak-users): $($_.Exception.Message)"
  }
}

Write-Host 'Health...'
$h = Invoke-RestMethod -Uri 'http://localhost:3001/health'
if ($h.status -ne 'ok') { throw 'API health not ok' }
Write-Host '  OK'

Write-Host 'Admin token (KMC municipality_admin)...'
$adminToken = Get-AdminToken
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

Write-Host 'E1: list / create category + subtype...'
$cats = @(Invoke-RestMethod -Uri "$base/admin/tenant/grievance-catalogue/categories" -Headers $adminHeaders)
$existing = $cats | Where-Object { $_.code -eq $categoryCode }
if (-not $existing) {
  $createdCat = Invoke-RestMethod -Method Post -Uri "$base/admin/tenant/grievance-catalogue/categories" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
      code       = $categoryCode
      name       = @{ en = 'Noise pollution'; bn = 'Noise pollution'; hi = 'Noise pollution' }
      icon       = 'Volume2'
      sort_order = 450
      is_active  = $true
    } | ConvertTo-Json -Depth 5)
  Write-Host "  Created category $($createdCat.code)"
} else {
  Write-Host "  Category $categoryCode already exists"
}

$subs = @(Invoke-RestMethod -Uri "$base/admin/tenant/grievance-catalogue/categories/$categoryCode/subtypes" -Headers $adminHeaders)
if (-not ($subs | Where-Object { $_.code -eq $subtypeCode })) {
  $createdSub = Invoke-RestMethod -Method Post -Uri "$base/admin/tenant/grievance-catalogue/categories/$categoryCode/subtypes" -Headers $adminHeaders -ContentType 'application/json' -Body (@{
      code       = $subtypeCode
      name       = @{ en = 'Construction noise'; bn = 'Construction noise'; hi = 'Construction noise' }
      sort_order = 0
      is_active  = $true
    } | ConvertTo-Json -Depth 5)
  Write-Host "  Created subtype $($createdSub.code)"
} else {
  Write-Host "  Subtype $subtypeCode already exists"
}

Write-Host 'E2: public catalogue includes new category...'
$pub = Invoke-RestMethod -Uri "$base/public/grievances/catalogue?tenant_code=KMC"
$pubCat = $pub.categories | Where-Object { $_.code -eq $categoryCode }
if (-not $pubCat) { throw "Public catalogue missing $categoryCode" }
Write-Host "  OK - $($pubCat.name.en) with $($pubCat.subtypes.Count) subtypes"

Write-Host 'Operations: PUT SLA (24h for noise-pollution)...'
$slaBody = @{
  policies = @(
    @{ sort_order = 0; category_match = $categoryCode; grievance_priority_match = $null; hours_to_resolve = 24 },
    @{ sort_order = 1; category_match = 'roads'; grievance_priority_match = $null; hours_to_resolve = 48 },
    @{ sort_order = 100; category_match = $null; grievance_priority_match = $null; hours_to_resolve = 72 }
  )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Put -Uri "$base/admin/tenant/sla-policies" -Headers $adminHeaders -ContentType 'application/json' -Body $slaBody | Out-Null
Write-Host '  OK'

Write-Host 'Operations: PUT routing (noise-pollution -> tenant_clerk)...'
$routeBody = @{
  rules = @(
    @{
      sort_order                 = 0
      category_match             = $categoryCode
      grievance_priority_match   = $null
      ward_id                    = $null
      target_role_code           = 'tenant_clerk'
      assign_user_id             = $null
    },
    @{
      sort_order                 = 100
      category_match             = $null
      grievance_priority_match   = $null
      ward_id                    = $null
      target_role_code           = 'municipality_clerk'
      assign_user_id             = $null
    }
  )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Put -Uri "$base/admin/tenant/grievance-routing-rules" -Headers $adminHeaders -ContentType 'application/json' -Body $routeBody | Out-Null
Write-Host '  OK'

Write-Host 'Citizen auth + file grievance...'
Invoke-RestMethod -Method Post -Uri "$base/auth/send-otp" -ContentType 'application/json' -Body (@{ mobile = $mobile } | ConvertTo-Json) | Out-Null
$tok = Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType 'application/json' -Body (@{ mobile = $mobile; otp = '12345' } | ConvertTo-Json)
$citizenHeaders = @{
  Authorization          = "Bearer $($tok.access_token)"
  'x-enagar-tenant-code' = 'KMC'
}
try {
  Invoke-RestMethod -Method Post -Uri "$base/citizen/register" -Headers $citizenHeaders -ContentType 'application/json' -Body (@{
      mobile       = $mobile
      display_name = 'Sprint 622 smoke'
    } | ConvertTo-Json) | Out-Null
} catch {
  # already registered
}

$filed = Invoke-RestMethod -Method Post -Uri "$base/grievances" -Headers $citizenHeaders -ContentType 'application/json' -Body (@{
    category            = $categoryCode
    subtype_code        = $subtypeCode
    description         = 'Sprint 6.22 live smoke - loud construction after hours'
    grievance_priority  = 'medium'
  } | ConvertTo-Json)
Write-Host "  Filed $($filed.grievance_no)"

Write-Host 'E3: SLA hours ~24...'
if (-not $filed.sla_due_at) { throw 'Missing sla_due_at' }
$due = [datetime]::Parse($filed.sla_due_at)
$created = [datetime]::Parse($filed.created_at)
$hours = ($due - $created).TotalHours
if ($hours -lt 23 -or $hours -gt 25) {
  throw "Expected ~24h SLA, got $([math]::Round($hours, 2))h (due=$($filed.sla_due_at))"
}
Write-Host "  OK - $([math]::Round($hours, 1))h"

Write-Host 'E4: routing role tenant_clerk...'
if ($filed.routed_role_code -ne 'tenant_clerk') {
  throw "Expected routed_role_code tenant_clerk, got $($filed.routed_role_code)"
}
Write-Host '  OK'

Write-Host 'E6: desk inbox labels...'
$desk = Invoke-RestMethod -Uri "$base/admin/tenant/desk/inbox/grievances?queue=all" -Headers $adminHeaders
if ($desk -isnot [System.Array]) {
  $desk = @($desk)
}
$grievanceNo = [string]$filed.grievance_no
$deskRow = $null
foreach ($candidate in $desk) {
  if ($candidate.grievance_no -ceq $grievanceNo) {
    $deskRow = $candidate
    break
  }
}
if (-not $deskRow) { throw "Filed grievance $grievanceNo not in desk inbox" }
$categoryLabel = [string]$deskRow.category_label
$subtypeLabel = [string]$deskRow.subtype_label
if ($categoryLabel -notlike '*Noise*') {
  throw "Expected localized category_label, got $categoryLabel"
}
if ($subtypeLabel -notlike '*Construction*') {
  throw "Expected localized subtype_label, got $subtypeLabel"
}
Write-Host "  OK - $categoryLabel / $subtypeLabel"

Write-Host ''
Write-Host 'ALL SPRINT 6.22 LIVE CHECKS PASSED'
