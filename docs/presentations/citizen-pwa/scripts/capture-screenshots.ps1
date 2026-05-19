# Capture Citizen PWA screenshots for the Reveal.js deck.
# Prereqs: pnpm --filter @enagar/citizen-pwa dev (http://localhost:3000), API :3001, DEV_AUTH_ENABLED, OTP 12345.
$ErrorActionPreference = 'Stop'
$assets = Resolve-Path (Join-Path $PSScriptRoot '..' 'assets')

function Snap($name) {
  agent-browser screenshot (Join-Path $assets $name)
}

function Wait-Snap {
  agent-browser wait 900
  agent-browser snapshot -i -c | Out-Null
}

agent-browser close --all 2>$null
agent-browser open http://localhost:3000
agent-browser set viewport 1280 1080
agent-browser wait --load networkidle

Snap '01-splash.png'
agent-browser click '@e2'
Wait-Snap
Snap '02-language.png'
agent-browser click '@e6'
Wait-Snap
Snap '03-login.png'
agent-browser fill '@e3' '9876543210'
agent-browser click '@e4'
agent-browser wait 2000
Wait-Snap
Snap '04-otp.png'
agent-browser fill '@e3' '12345'
agent-browser click '@e4'
agent-browser wait 3500
Wait-Snap
Snap '06-hub-home.png'

$nav = agent-browser snapshot -i -c 2>&1 | Out-String
if ($nav -match 'Applications.*ref=e(\d+)') {
  agent-browser click "@e$($Matches[1])"
  agent-browser wait 2000
  Snap '07-hub-applications.png'
}
agent-browser click '@e6'
Wait-Snap
if ($nav -match 'Grievances.*ref=e(\d+)') {
  agent-browser click "@e$($Matches[1])"
  agent-browser wait 2000
  Snap '08-hub-grievances.png'
}
agent-browser click '@e6'
Wait-Snap
if ($nav -match 'Apply.*ref=e(\d+)') {
  agent-browser click "@e$($Matches[1])"
  agent-browser wait 2000
  Snap '09-hub-apply.png'
}
agent-browser click '@e6'
Wait-Snap
agent-browser snapshot -i -c | Out-String | Out-Null
agent-browser click '@e6'
agent-browser wait 4000
Wait-Snap
Snap '10-workspace-kmc-home.png'

$ws = agent-browser snapshot -i -c 2>&1 | Out-String
foreach ($pair in @(
    @{ Tab = 'Services'; File = '11-workspace-services.png' },
    @{ Tab = 'Applications'; File = '12-workspace-applications.png' },
    @{ Tab = 'Grievances'; File = '13-workspace-grievances.png' },
    @{ Tab = 'Apply'; File = '14-workspace-apply.png' }
  )) {
  if ($ws -match "$($pair.Tab).*ref=e(\d+)") {
    agent-browser click "@e$($Matches[1])"
    agent-browser wait 2000
    Snap $pair.File
    $ws = agent-browser snapshot -i -c 2>&1 | Out-String
  }
}

agent-browser close
Write-Host "Screenshots written to $assets"
