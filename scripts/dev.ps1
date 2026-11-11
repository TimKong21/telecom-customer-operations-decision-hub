param([switch]$Production)
$ErrorActionPreference = 'Stop'
$runtimeNode = $null
foreach ($candidate in (Get-Command node -All -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -Unique)) {
    $candidateVersion = [version]((& $candidate --version).TrimStart('v'))
    if ($candidateVersion -ge [version]'22.12.0') { $runtimeNode = $candidate; break }
}
if (-not $runtimeNode) { throw 'Node.js 22.12+ is required. Install it or add an existing compatible runtime to PATH.' }
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) { throw 'Dependencies are missing. Run npm ci with Node.js 22.12+ first.' }
    if ($Production) { & $runtimeNode node_modules/vite/bin/vite.js preview --host 127.0.0.1 }
    else { & $runtimeNode node_modules/vite/bin/vite.js --host 127.0.0.1 }
} finally { Pop-Location }
