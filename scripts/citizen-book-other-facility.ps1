# Citizen API path for other-facility-booking (mirrors PWA booking workspace)
$ErrorActionPreference = 'Stop'

$tenant = 'KMC'
$service = 'other-facility-booking'
$asset = 'kmc-multipurpose-ground'
$mobile = '9876543210'

$otp = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/verify-otp' -Method POST -ContentType 'application/json' -Body (@{ mobile = $mobile; otp = '12345' } | ConvertTo-Json)
$h = @{
  Authorization = "Bearer $($otp.access_token)"
  'Content-Type' = 'application/json'
  'X-Enagar-Tenant-Code' = $tenant
}

Invoke-RestMethod -Uri 'http://localhost:3001/api/citizen/select-tenant' -Method POST -Headers $h -Body (@{ tenant_code = $tenant } | ConvertTo-Json) | Out-Null

$from = '2026-06-12T00:00:00.000Z'
$to = '2026-06-13T00:00:00.000Z'
$slots = Invoke-RestMethod -Uri "http://localhost:3001/api/public/bookings/assets/$asset/slots?tenant_code=$tenant&from=$from&to=$to&service_code=$service"
$free = $slots.slots | Where-Object { $_.status -eq 'free' } | Select-Object -First 1
if (-not $free) { throw 'No free slot on kmc-multipurpose-ground' }
Write-Host "Slot: $($free.starts_at) -> $($free.ends_at)"

$quote = Invoke-RestMethod -Uri 'http://localhost:3001/api/citizen/bookings/quote' -Method POST -Headers $h -Body (@{
  tenant_code = $tenant
  service_code = $service
  asset_code = $asset
  starts_at = $free.starts_at
  ends_at = $free.ends_at
} | ConvertTo-Json)

$hold = Invoke-RestMethod -Uri 'http://localhost:3001/api/citizen/bookings/holds' -Method POST -Headers $h -Body (@{
  tenant_code = $tenant
  service_code = $service
  asset_code = $asset
  starts_at = $free.starts_at
  ends_at = $free.ends_at
} | ConvertTo-Json)
Write-Host "Hold: $($hold.id)"

$draft = Invoke-RestMethod -Uri 'http://localhost:3001/api/applications/drafts' -Method POST -Headers $h -Body (@{
  service_code = $service
  form_data = @{
    applicant_name = 'Smoke Citizen'
    event_date = '2026-06-12'
    guest_count = 50
    event_details = 'Sports facility smoke booking for Sprint 8.1'
    bookable_asset_code = $asset
    booking_starts_at = $free.starts_at
    booking_ends_at = $free.ends_at
    booking_rent_paise = $quote.rent_paise
    booking_deposit_paise = $quote.deposit_paise
    booking_application_fee_paise = 500000
    booking_upfront_total_paise = 500000 + $quote.rent_paise + $quote.deposit_paise
  }
} | ConvertTo-Json -Depth 5)
Write-Host "Draft: $($draft.docket_no)"

$payHeaders = @{
  Authorization = "Bearer $($otp.access_token)"
  'Content-Type' = 'application/json'
  'X-Enagar-Tenant-Code' = $tenant
  'idempotency-key' = "hall-app-$($draft.id)"
}
$appPay = Invoke-RestMethod -Uri 'http://localhost:3001/api/payments/initiate' -Method POST -Headers $payHeaders -Body (@{
  application_id = $draft.id
  amount_paise = 500000
  method = 'upi'
  fee_code = 'application'
} | ConvertTo-Json)
Invoke-RestMethod -Uri 'http://localhost:3001/api/payments/stub/complete' -Method POST -Headers $h -Body (@{
  payment_id = $appPay.id
  gateway_order_id = $appPay.gateway_order_id
} | ConvertTo-Json) | Out-Null

$checkout = Invoke-RestMethod -Uri "http://localhost:3001/api/citizen/bookings/holds/$($hold.id)/initiate-payment" -Method POST -Headers @{
  Authorization = "Bearer $($otp.access_token)"
  'Content-Type' = 'application/json'
  'X-Enagar-Tenant-Code' = $tenant
  'idempotency-key' = "booking-$($hold.id)"
} -Body (@{ method = 'upi'; include_rent = $true } | ConvertTo-Json)
Invoke-RestMethod -Uri 'http://localhost:3001/api/payments/stub/complete' -Method POST -Headers $h -Body (@{
  payment_id = $checkout.payment.id
  gateway_order_id = $checkout.payment.gateway_order_id
} | ConvertTo-Json) | Out-Null

Invoke-RestMethod -Uri "http://localhost:3001/api/citizen/bookings/holds/$($hold.id)/link-application" -Method POST -Headers $h -Body (@{ application_id = $draft.id } | ConvertTo-Json) | Out-Null
$submitted = Invoke-RestMethod -Uri "http://localhost:3001/api/applications/$($draft.id)/submit" -Method POST -Headers $h
Write-Host "Submitted: $($submitted.docket_no) stage=$($submitted.current_stage)"
