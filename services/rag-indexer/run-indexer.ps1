# Run the RAG indexer without Poetry (Windows / PowerShell).
# Usage: .\run-indexer.ps1
#        .\run-indexer.ps1 -Reload

param([switch]$Reload)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function Find-Python {
    foreach ($cmd in @("py -3.12", "py -3.11", "py -3", "python")) {
        try {
            $ver = Invoke-Expression "$cmd --version" 2>$null
            if ($LASTEXITCODE -eq 0 -or $ver -match "Python") { return $cmd }
        } catch { continue }
    }
    throw "No Python 3.11+ found. Install from https://www.python.org/downloads/"
}

$py = Find-Python
$venv = Join-Path $Root ".venv"

if (-not (Test-Path (Join-Path $venv "Scripts\python.exe"))) {
    Write-Host "Creating virtualenv at $venv ..."
    Invoke-Expression "$py -m venv `"$venv`""
}

$python = Join-Path $venv "Scripts\python.exe"
$pip = Join-Path $venv "Scripts\pip.exe"

Write-Host "Installing dependencies (first run may download the embedding model) ..."
& $pip install -q -r (Join-Path $Root "requirements.txt")

$env:PYTHONPATH = Join-Path $Root "src"
# Load DATABASE_URL / QDRANT_URL from repo infrastructure/.env if present
$infraEnv = Join-Path $Root "..\..\infrastructure\.env"
if (Test-Path $infraEnv) {
    Get-Content $infraEnv | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"')
            if ($name -in @("DATABASE_URL", "QDRANT_URL", "RAG_INDEXER_PORT")) {
                Set-Item -Path "env:$name" -Value $value
            }
        }
    }
}

$port = if ($env:RAG_INDEXER_PORT) { $env:RAG_INDEXER_PORT } else { "8100" }
$reloadArg = if ($Reload) { "--reload" } else { "" }

Write-Host "Starting uvicorn on http://127.0.0.1:$port ..."
& (Join-Path $venv "Scripts\uvicorn.exe") enagar_rag_indexer.main:app --host 127.0.0.1 --port $port $reloadArg
