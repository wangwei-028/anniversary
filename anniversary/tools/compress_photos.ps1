# 压缩 assets/photos 下的照片供游戏使用（原图备份到 assets/photos/original/）。
# 输出：最长边 1600px、质量 85 的 JPG；按 EXIF 方向转正像素，避免游戏里横躺。
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File tools\compress_photos.ps1
param(
    [int]$MaxSide = 1600,
    [int]$Quality = 85
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$photos = Join-Path $PSScriptRoot '..\assets\photos'
$backup = Join-Path $photos 'original'
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$jpegEnc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' }

Get-ChildItem $photos -Filter *.jpg | ForEach-Object {
    $name = $_.Name
    Copy-Item $_.FullName (Join-Path $backup $name) -Force

    $img = [System.Drawing.Image]::FromFile($_.FullName)

    # 按 EXIF Orientation(274) 把像素转正
    $orient = 1
    foreach ($p in $img.PropertyItems) {
        if ($p.Id -eq 274) { $orient = $p.Value[0] }
    }
    switch ($orient) {
        6 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
        8 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
        3 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
    }

    $w = $img.Width; $h = $img.Height
    if ([Math]::Max($w, $h) -gt $MaxSide) {
        if ($w -ge $h) { $nw = $MaxSide; $nh = [int][Math]::Round($h * $MaxSide / $w) }
        else { $nh = $MaxSide; $nw = [int][Math]::Round($w * $MaxSide / $h) }
    } else { $nw = $w; $nh = $h }

    $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.DrawImage($img, 0, 0, $nw, $nh)
    $gfx.Dispose()
    $img.Dispose()

    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
    $outPath = Join-Path $photos ("tmp_" + $name)
    $bmp.Save($outPath, $jpegEnc, $ep)
    $bmp.Dispose()

    Move-Item -Force $outPath $_.FullName
    $kb = [int][Math]::Round($_.Length / 1KB)
    Write-Host "$name -> ${nw}x${nh} (${kb} KB)"
}
Write-Host 'Done. 原图备份在 assets/photos/original/'
