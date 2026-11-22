# Development CI only: install the SHA-pinned official USER build into a
# disposable runner directory. Never point this script at a user's installation.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'This installer test is restricted to disposable GitHub Actions runners.' }
$repoRoot = Split-Path $PSScriptRoot -Parent
$cache = Join-Path $repoRoot '.antigravity-test/2.8.0-windows'
$appDir = Join-Path $cache 'Antigravity IDE'
$installer = Join-Path $cache 'official-user-installer.exe'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$url = 'https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/2.8.0-6733682917113856/windows-x64/Antigravity%20IDE.exe'
$archiveHash = '0f63d94c0be212e25157125eb3757272b5aa95ea06538298631c14a3d7709197'
$mainHash = '187c3f56c0947da78d5991cb0ab34acbf00766bbeb96d7b3781f3b4fd8bffe4d'
Invoke-WebRequest -Uri $url -OutFile $installer
if ((Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archiveHash) { throw 'Official Windows installer SHA-256 mismatch.' }
$arguments = '/SP- /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CURRENTUSER /NOICONS /MERGETASKS="!runcode,!addtopath,!associatewithfiles,!addcontextmenufiles,!addcontextmenufolders" /DIR="' + $appDir + '"'
$installation = Start-Process -FilePath $installer -ArgumentList $arguments -Wait -PassThru
if ($installation.ExitCode -ne 0) { throw "Disposable installer failed: $($installation.ExitCode)" }
$appRoot = Join-Path $appDir 'resources/app'
$product = Get-Content (Join-Path $appRoot 'product.json') -Raw | ConvertFrom-Json
$package = Get-Content (Join-Path $appRoot 'package.json') -Raw | ConvertFrom-Json
if ($product.ideVersion -ne '2.8.0' -or $product.applicationName -ne 'antigravity-ide' -or $product.nameLong -ne 'Antigravity IDE') { throw 'Unexpected Windows product identity.' }
if ($package.main -ne './out/main.js' -or $package.type -ne 'module') { throw 'Unexpected Windows main entry.' }
if ((Get-FileHash (Join-Path $appRoot 'out/main.js') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $mainHash) { throw 'Windows main entry SHA-256 mismatch.' }
$executable = Join-Path $appDir 'Antigravity IDE.exe'
if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw 'Expected isolated Windows application executable is missing.' }
$report = @{ ideVersion = '2.8.0'; platform = 'win32'; archiveSha256 = $archiveHash; mainSha256 = $mainHash; scope = 'Official USER build installed into a disposable GitHub Actions runner; no user profile or Google account used.' }
$artifacts = Join-Path $repoRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$report | ConvertTo-Json | Set-Content (Join-Path $artifacts 'antigravity-source-2.8.0-windows.json') -Encoding utf8
"executable=$executable" | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding utf8 -Append
Write-Host '[antigravity-windows] Verified official USER installer, product identity and main entry.'
