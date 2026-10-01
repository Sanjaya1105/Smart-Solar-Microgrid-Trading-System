$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$publishDirectory = Join-Path $projectRoot 'artifacts/iis-publish'
Push-Location $projectRoot
try {
    npm.cmd run build --prefix web
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    dotnet publish SolarMicrogrid.Api/SolarMicrogrid.Api.csproj -c Release -o $publishDirectory
    if ($LASTEXITCODE -ne 0) { throw 'API publish failed.' }
    $staticDirectory = Join-Path $publishDirectory 'wwwroot'
    New-Item -ItemType Directory -Force -Path $staticDirectory | Out-Null
    Copy-Item -Path (Join-Path $projectRoot 'web/dist/*') -Destination $staticDirectory -Recurse -Force
    Write-Output "IIS package ready: $publishDirectory"
} finally {
    Pop-Location
}
