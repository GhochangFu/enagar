# Provision other-facility-booking + publish booking workflow via API
$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '..\infrastructure\.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*DATABASE_URL=(.+)$') { $env:DATABASE_URL = $matches[1].Trim() }
  }
}

Write-Host '=== DB provision (global + tenant service + asset mapping) ==='
$provisionOut = pnpm --filter @enagar/api exec tsx ../../scripts/provision-other-facility-booking.ts 2>&1
$provisionOut | Write-Host
$meta = $provisionOut | Select-String '^\{' | ForEach-Object { $_.Line } | Select-Object -Last 1 | ConvertFrom-Json
$serviceId = $meta.service_id
if (-not $serviceId) { throw 'provision script did not return service_id' }

$tokenBody = 'grant_type=password&client_id=admin-tenant&username=kmc-tenant-admin-dummy&password=DummyDev_2026!ChangeMe'
$token = (Invoke-RestMethod -Uri 'http://localhost:8080/realms/enagar/protocol/openid-connect/token' -Method POST -ContentType 'application/x-www-form-urlencoded' -Body $tokenBody).access_token
$h = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

Write-Host "=== Publish booking workflow on $serviceId ==="
$hallDesigner = Invoke-RestMethod -Uri 'http://localhost:3001/api/admin/tenant/services/fcba5a60-9d4f-4e49-bb62-d7549531a01d/designer' -Headers $h
$workflowDef = $hallDesigner.workflow_published.definition
$workflowDef.code = 'other-facility-booking-booking-v1'
$workflowBody = @{ workflow = $workflowDef } | ConvertTo-Json -Depth 12
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/tenant/services/$serviceId/workflow-draft" -Method PATCH -Headers $h -Body $workflowBody | Out-Null
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/tenant/services/$serviceId/workflow-draft/publish" -Method PATCH -Headers $h | Out-Null

Write-Host '=== Verify public assets ==='
$hall = Invoke-RestMethod -Uri 'http://localhost:3001/api/public/bookings/assets?tenant_code=KMC&service_code=community-hall'
$other = Invoke-RestMethod -Uri 'http://localhost:3001/api/public/bookings/assets?tenant_code=KMC&service_code=other-facility-booking'
Write-Host "community-hall assets: $($hall.Count) -> $($hall.code -join ', ')"
Write-Host "other-facility-booking assets: $($other.Count) -> $($other.code -join ', ')"

Write-Host "Service designer: http://localhost:3002/dashboard/services/$serviceId"
