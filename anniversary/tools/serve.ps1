# Local static server for the game (zero dependencies, uses built-in .NET HttpListener).
# Started by "启动游戏.bat". Only listens on localhost; only serves files inside the game folder.
# NOTE: keep this file ASCII-only (Windows PowerShell 5.1 reads BOM-less files with the ANSI code page).

param(
  [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$defaultPort = $Port

# Saves (localStorage) belong to the exact address incl. port, so if the game server is
# already running on the default port, just open it again instead of starting a new one.
try {
  $probe = Invoke-WebRequest -Uri "http://localhost:$Port/index.html" -UseBasicParsing -TimeoutSec 2
  if ($probe.StatusCode -eq 200 -and $probe.Content -match 'main\.js') {
    Write-Host "Game server already running: http://localhost:$Port/"
    if (-not $env:NO_BROWSER) { Start-Process "http://localhost:$Port/" }
    exit 0
  }
} catch {}

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.webp' = 'image/webp'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.mp3'  = 'audio/mpeg'
  '.ogg'  = 'audio/ogg'
  '.wav'  = 'audio/wav'
  '.webmanifest' = 'application/manifest+json'
}

# Find a free port (try up to 20)
$listener = $null
for ($i = 0; $i -lt 20; $i++) {
  $try = $Port + $i
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$try/")
  try {
    $l.Start()
    $listener = $l
    $Port = $try
    break
  } catch {
    $l.Close()
  }
}
if (-not $listener) {
  Write-Host 'Could not start the local server (no free port). Try Firefox, or deploy to GitHub Pages.'
  Read-Host 'Press Enter to exit'
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host ''
Write-Host '  Ben Xiang Ni - local game server is running'
Write-Host "  Open: $url"
Write-Host '  Close this window to stop the server.'
if ($Port -ne $defaultPort) {
  Write-Host "  WARNING: port $defaultPort is used by another program. Saves are tied to the port,"
  Write-Host "  so progress saved on port $defaultPort will not show up here."
}
Write-Host ''
if (-not $env:NO_BROWSER) { Start-Process $url }

$rootFull = [System.IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($rel.EndsWith('/')) { $rel = $rel + 'index.html' }
    $rel = $rel.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    # Block path traversal: the resolved file must stay inside the game folder
    if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('404')
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $type = $mime[$ext]
      if (-not $type) { $type = 'application/octet-stream' }
      $res.ContentType = $type
      $res.Headers.Add('Cache-Control', 'no-store')
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.OutputStream.Close() } catch {}
  }
}
