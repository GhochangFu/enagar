# Sprint 6.23 mobile web smoke (manual companion). Requires:
# - API :3001, Expo web :8081, DEV_OTP 12345, KMC catalogue with broken-streetlight + subtypes (6.22).
# Run: pnpm --filter @enagar/mobile dev → open http://localhost:8081/login
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3001/api'
$mobile = '9836177767'
$otp = '12345'

Write-Host 'Health...'
$h = Invoke-RestMethod -Uri 'http://localhost:3001/health'
if ($h.status -ne 'ok') { throw 'API health not ok' }

Write-Host 'Public catalogue (KMC) includes broken-streetlight...'
$pub = Invoke-RestMethod -Uri "$base/public/grievances/catalogue?tenant_code=KMC"
$cat = $pub.categories | Where-Object { $_.code -eq 'broken-streetlight' }
if (-not $cat) { throw 'Missing broken-streetlight in public catalogue' }
$sub = $cat.subtypes | Where-Object { $_.code -eq 'lamp-out' }
if (-not $sub) { throw 'Missing lamp-out subtype' }
Write-Host "  OK: $($cat.name.en) / $($sub.name.en)"

Write-Host 'Citizen OTP + file grievance (API parity check)...'
$send = Invoke-RestMethod -Method Post -Uri "$base/auth/send-otp" -ContentType 'application/json' -Body (@{ mobile = $mobile; tenant_code = 'WBPORTAL' } | ConvertTo-Json)
if ($send.status -ne 'otp_requested') { throw 'send-otp failed' }
$tok = Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType 'application/json' -Body (@{ mobile = $mobile; otp = $otp; tenant_code = 'WBPORTAL' } | ConvertTo-Json)
$headers = @{
  Authorization = "Bearer $($tok.access_token)"
  'x-enagar-tenant-code' = 'KMC'
  'content-type' = 'application/json'
}
$body = @{
  category = 'broken-streetlight'
  subtype_code = 'lamp-out'
  description = "Sprint 6.23 API smoke $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  grievance_priority = 'medium'
  location = @{ address = 'Mobile smoke script' }
} | ConvertTo-Json -Depth 5
$created = Invoke-RestMethod -Method Post -Uri "$base/grievances" -Headers $headers -Body $body
Write-Host "  Created $($created.grievance_no) category=$($created.category) subtype=$($created.subtype_code)"

Write-Host ''
Write-Host 'Manual UI (Expo web): http://localhost:8081/login'
Write-Host '  1. OTP' $mobile '/' $otp
Write-Host '  2. Hub - Grievances - File a grievance - KMC'
Write-Host '  3. Broken streetlight - Lamp out - Submit'
Write-Host '  4. List shows labels: Broken streetlight / Lamp out'
Write-Host 'Sprint 6.23 mobile smoke API leg OK.'
