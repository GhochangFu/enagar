# Sprint 6.21 live API smoke (dev OTP). Requires API on :3001 and DEV_AUTH_ENABLED.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3001/api'
$mobile = '9836177767'

Write-Host 'E2: public catalogue...'
$cat = Invoke-RestMethod -Uri "$base/public/grievances/catalogue?tenant_code=KMC"
if ($cat.categories.Count -lt 10) { throw "Expected >=10 categories, got $($cat.categories.Count)" }
Write-Host "  OK — $($cat.categories.Count) categories"

Write-Host 'Auth: OTP...'
Invoke-RestMethod -Method Post -Uri "$base/auth/send-otp" -ContentType 'application/json' -Body (@{ mobile = $mobile } | ConvertTo-Json) | Out-Null
$tok = Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType 'application/json' -Body (@{ mobile = $mobile; otp = '12345' } | ConvertTo-Json)
$headers = @{
  Authorization = "Bearer $($tok.access_token)"
  'x-enagar-tenant-code' = 'KMC'
}

Write-Host 'E3: invalid category -> 400...'
try {
  Invoke-RestMethod -Method Post -Uri "$base/grievances" -Headers $headers -ContentType 'application/json' -Body (@{
    category = 'not-a-real-category'
    description = 'Should fail'
  } | ConvertTo-Json)
  throw 'Expected 400 for invalid category'
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 400) { throw $_ }
  Write-Host '  OK — 400'
}

Write-Host 'E4: valid category -> 201...'
$created = Invoke-RestMethod -Method Post -Uri "$base/grievances" -Headers $headers -ContentType 'application/json' -Body (@{
  category = 'roads'
  description = 'Sprint 621 engineering check — pothole on test lane'
  grievance_priority = 'medium'
} | ConvertTo-Json)
if (-not $created.grievance_no) { throw 'Missing grievance_no' }
Write-Host "  OK — $($created.grievance_no)"

Write-Host 'E5: list + detail regression...'
$list = Invoke-RestMethod -Uri "$base/grievances" -Headers $headers
$found = $list | Where-Object { $_.id -eq $created.id }
if (-not $found) { throw 'Created grievance not in list' }
$detail = Invoke-RestMethod -Uri "$base/grievances/$($created.grievance_no)" -Headers $headers
if ($detail.grievance.category -ne 'roads') { throw 'Detail category mismatch' }
Write-Host '  OK — list + detail'

Write-Host 'Authenticated catalogue...'
$scoped = Invoke-RestMethod -Uri "$base/grievances/catalogue" -Headers $headers
if ($scoped.tenant_code -ne 'KMC') { throw 'Scoped catalogue tenant mismatch' }
Write-Host '  OK'

Write-Host 'ALL SPRINT 6.21 LIVE CHECKS PASSED'
