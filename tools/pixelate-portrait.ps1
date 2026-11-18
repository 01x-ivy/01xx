# 照片像素化立绘生产线：zhizhi-ref-face.jpg -> 4 个像素变体
# 用法：powershell -File tools\pixelate-portrait.ps1
Add-Type -AssemblyName System.Drawing

$ws   = 'C:\Users\33433\Documents\deepseek-harness\default-workspace'
$srcP = Join-Path $ws 'zhizhi-ref-face.jpg'
$outD = Join-Path $ws 'zhizhi-min\zhizhi-min\assets_src\px'
New-Item -ItemType Directory -Force -Path $outD | Out-Null

$src = New-Object System.Drawing.Bitmap($srcP)
$W = $src.Width; $H = $src.Height
Write-Host "source ${W}x${H}"

function Lum($r, $g, $b) { return (0.30 * $r + 0.59 * $g + 0.11 * $b) }

# 区域平均降采样到 gw x gh 网格
function Grid-Downsample($srcBmp, $rx, $ry, $rw, $rh, $gw, $gh) {
  $g = New-Object System.Drawing.Bitmap($gw, $gh)
  for ($gy = 0; $gy -lt $gh; $gy++) {
    for ($gx = 0; $gx -lt $gw; $gx++) {
      $x0 = $rx + [math]::Floor($gx * $rw / $gw); $x1 = $rx + [math]::Floor(($gx + 1) * $rw / $gw)
      $y0 = $ry + [math]::Floor($gy * $rh / $gh); $y1 = $ry + [math]::Floor(($gy + 1) * $rh / $gh)
      if ($x1 -le $x0) { $x1 = $x0 + 1 }; if ($y1 -le $y0) { $y1 = $y0 + 1 }
      $sr = 0; $sg = 0; $sb = 0; $n = 0
      for ($y = $y0; $y -lt $y1; $y++) {
        for ($x = $x0; $x -lt $x1; $x++) {
          $p = $srcBmp.GetPixel($x, $y); $sr += $p.R; $sg += $p.G; $sb += $p.B; $n++
        }
      }
      $g.SetPixel($gx, $gy, [System.Drawing.Color]::FromArgb(255, [int]($sr / $n), [int]($sg / $n), [int]($sb / $n)))
    }
  }
  return $g
}

# 色阶量化（每通道 levels 级），制造像素画限色感
function Grid-Posterize($g, $levels) {
  $step = 255.0 / ($levels - 1)
  for ($y = 0; $y -lt $g.Height; $y++) {
    for ($x = 0; $x -lt $g.Width; $x++) {
      $p = $g.GetPixel($x, $y)
      $q = [math]::Round($p.R / $step) * $step
      $r = [int][math]::Min(255, $q)
      $q = [math]::Round($p.G / $step) * $step
      $gg = [int][math]::Min(255, $q)
      $q = [math]::Round($p.B / $step) * $step
      $b = [int][math]::Min(255, $q)
      $g.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $gg, $b))
    }
  }
  return $g
}

# 邻域亮度差描边：差值超阈值的格染深色轮廓
function Grid-Outline($g, $thresh, $oc) {
  $gw = $g.Width; $gh = $g.Height
  $mark = New-Object 'bool[,]' $gw, $gh
  for ($y = 0; $y -lt $gh; $y++) {
    for ($x = 0; $x -lt $gw; $x++) {
      $p = $g.GetPixel($x, $y); $l = Lum $p.R $p.G $p.B
      if ($x -gt 0) {
        $pl = $g.GetPixel($x - 1, $y)
        if ([math]::Abs($l - (Lum $pl.R $pl.G $pl.B)) -gt $thresh) { $mark[$x, $y] = $true }
      }
      if ($y -gt 0) {
        $pu = $g.GetPixel($x, $y - 1)
        if ([math]::Abs($l - (Lum $pu.R $pu.G $pu.B)) -gt $thresh) { $mark[$x, $y] = $true }
      }
    }
  }
  for ($y = 0; $y -lt $gh; $y++) {
    for ($x = 0; $x -lt $gw; $x++) { if ($mark[$x, $y]) { $g.SetPixel($x, $y, $oc) } }
  }
  return $g
}

# nearest 放大
function Grid-Upscale($g, $scale) {
  $u = New-Object System.Drawing.Bitmap(($g.Width * $scale), ($g.Height * $scale))
  for ($y = 0; $y -lt $u.Height; $y++) {
    for ($x = 0; $x -lt $u.Width; $x++) {
      $u.SetPixel($x, $y, $g.GetPixel([math]::Floor($x / $scale), [math]::Floor($y / $scale)))
    }
  }
  return $u
}

function Save-Png($bmp, $name) {
  $p = Join-Path $outD $name
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "saved $name $($bmp.Width)x$($bmp.Height)"
}

$outlineCol = [System.Drawing.Color]::FromArgb(255, 36, 26, 32)
$darkPen    = New-Object System.Drawing.SolidBrush($outlineCol)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))

# 裁切区（1280x1280 原图）：半身含握拳 / 脸部特写方区
$halfX = 160; $halfY = 40; $halfW = 960; $halfH = 1240
$faceX = 300; $faceY = 60; $faceW = 720; $faceH = 720

# ---- V1 卡片框 48x64 ----
$g1 = Grid-Downsample $src $halfX $halfY $halfW $halfH 48 64
$g1 = Grid-Posterize $g1 6
$g1 = Grid-Outline $g1 55 $outlineCol
$u1 = Grid-Upscale $g1 3
$c1 = New-Object System.Drawing.Bitmap(152, 200)
$gr = [System.Drawing.Graphics]::FromImage($c1)
$gr.FillRectangle($darkPen, 0, 0, 152, 200)
$gr.DrawImageUnscaled($u1, 4, 4)
$gr.Dispose()
Save-Png $c1 'v1_card.png'

# ---- V2 拍立得 48x64 ----
$c2 = New-Object System.Drawing.Bitmap(176, 240)
$gr = [System.Drawing.Graphics]::FromImage($c2)
$gr.FillRectangle($whiteBrush, 0, 0, 176, 240)
$gr.DrawImageUnscaled($u1, 16, 14)
$gp = New-Object System.Drawing.Pen($outlineCol, 2)
$gr.DrawRectangle($gp, 15, 13, 146, 194)
$gr.Dispose()
Save-Png $c2 'v2_polaroid.png'

# ---- V3 圆形徽章 48x48 脸部 ----
$g3 = Grid-Downsample $src $faceX $faceY $faceW $faceH 48 48
$g3 = Grid-Posterize $g3 6
$g3 = Grid-Outline $g3 55 $outlineCol
$u3 = Grid-Upscale $g3 3
$c3 = New-Object System.Drawing.Bitmap(150, 150)
for ($y = 0; $y -lt 150; $y++) {
  for ($x = 0; $x -lt 150; $x++) {
    $dx = $x - 75; $dy = $y - 75; $d = [math]::Sqrt($dx * $dx + $dy * $dy)
    if ($d -le 69) {
      $sx = $x - 3; $sy = $y - 3
      if ($sx -ge 0 -and $sx -lt 144 -and $sy -ge 0 -and $sy -lt 144) {
        $c3.SetPixel($x, $y, $u3.GetPixel($sx, $sy))
      } else { $c3.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)) }
    } elseif ($d -le 73) {
      $c3.SetPixel($x, $y, $outlineCol)
    } else {
      $c3.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    }
  }
}
Save-Png $c3 'v3_circle.png'

# ---- V4 粗格 24x32 卡片 ----
$g4 = Grid-Downsample $src $halfX $halfY $halfW $halfH 24 32
$g4 = Grid-Posterize $g4 5
$g4 = Grid-Outline $g4 50 $outlineCol
$u4 = Grid-Upscale $g4 6
$c4 = New-Object System.Drawing.Bitmap(152, 200)
$gr = [System.Drawing.Graphics]::FromImage($c4)
$gr.FillRectangle($darkPen, 0, 0, 152, 200)
$gr.DrawImageUnscaled($u4, 4, 4)
$gr.Dispose()
Save-Png $c4 'v4_chunky.png'

Write-Host 'done'
