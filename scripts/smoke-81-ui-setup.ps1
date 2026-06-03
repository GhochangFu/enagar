# Sprint 8.1 UI smoke — data setup (assets, availability, service mapping)
$ErrorActionPreference = 'Stop'
$tokenBody = 'grant_type=password&client_id=admin-tenant&username=kmc-tenant-admin-dummy&password=DummyDev_2026!ChangeMe'
$token = (Invoke-RestMethod -Uri 'http://localhost:8080/realms/enagar/protocol/openid-connect/token' -Method POST -ContentType 'application/x-www-form-urlencoded' -Body $tokenBody).access_token
$h = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

function Patch-Asset($code, $nameEn, $capacity) {
  $payload = @{
    code = $code
    asset_type = 'HALL'
    name = @{ en = $nameEn; bn = $nameEn; hi = $nameEn }
    location = @{ ward = '012'; address = "KMC Sports Complex - $nameEn" }
    capacity = "$capacity"
    rate_unit = 'HOUR'
    base_rate_paise = '80000'
    security_deposit_paise = '300000'
    slot_step_minutes = '60'
    rules = @{
      min_duration_minutes = 60
      max_duration_minutes = 480
      open_time = '09:00'
      close_time = '21:00'
    }
    is_active = $true
    metadata = @{}
  } | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Uri 'http://localhost:3001/api/admin/tenant/bookings/assets' -Method PATCH -Headers $h -Body $payload | Out-Null
  Write-Host "Asset upserted: $code"
}

Patch-Asset 'kmc-multipurpose-ground' 'Multipurpose Sports Ground' 500
Patch-Asset 'kmc-tennis-court-a' 'Tennis Court A' 4

$bulk = @{
  asset_code = 'kmc-multipurpose-ground'
  from_date = '2026-06-10'
  to_date = '2026-06-24'
  weekdays = @(1, 2, 3, 4, 5)
  start_time = '09:00'
  end_time = '21:00'
  kind = 'available'
  note = 'Smoke 81 sports ground availability'
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3001/api/admin/tenant/bookings/availability/bulk' -Method POST -Headers $h -Body $bulk | Out-Null
Write-Host 'Bulk availability: kmc-multipurpose-ground'

$bulk2 = $bulk | ConvertFrom-Json
$bulk2.asset_code = 'kmc-tennis-court-a'
$bulk2.note = 'Smoke 81 tennis court availability'
Invoke-RestMethod -Uri 'http://localhost:3001/api/admin/tenant/bookings/availability/bulk' -Method POST -Headers $h -Body ($bulk2 | ConvertTo-Json) | Out-Null
Write-Host 'Bulk availability: kmc-tennis-court-a'

$catalogue = Invoke-RestMethod -Uri 'http://localhost:3001/api/admin/tenant/services' -Headers $h
$hall = $catalogue | Where-Object { $_.code -eq 'community-hall' } | Select-Object -First 1
if (-not $hall) { throw 'community-hall service not found' }

$mapPayload = @{
  bookable_asset_codes = @(
    'community-hall-main',
    'rabindra-bhawan',
    'kmc-multipurpose-ground',
    'kmc-tennis-court-a'
  )
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/tenant/services/$($hall.id)/config" -Method PATCH -Headers $h -Body $mapPayload | Out-Null
Write-Host "Mapped 4 assets on community-hall service $($hall.id)"

$public = Invoke-RestMethod -Uri 'http://localhost:3001/api/public/bookings/assets?tenant_code=KMC&service_code=community-hall'
Write-Host "Public assets count: $($public.Count)"
$public | ForEach-Object { Write-Host "  - $($_.code)" }
