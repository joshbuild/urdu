# Derive the sponsor-supplied artwork; no image-generation or extra dependency needed.
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$source = [System.Drawing.Bitmap]::new((Join-Path $projectRoot 'design/icon/icon_1254.png'))
try {
    $teal = $source.GetPixel(0, 0)
    $iconDirectory = Join-Path $projectRoot 'public/icons'
    [System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
    foreach ($spec in @(
        @{ Size = 192; Inset = 0; Name = 'icon-192.png' },
        @{ Size = 512; Inset = 0; Name = 'icon-512.png' },
        @{ Size = 512; Inset = 64; Name = 'icon-maskable-512.png' }
    )) {
        $bitmap = [System.Drawing.Bitmap]::new($spec.Size, $spec.Size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear($teal)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($source, $spec.Inset, $spec.Inset, ($spec.Size - 2 * $spec.Inset), ($spec.Size - 2 * $spec.Inset))
            $bitmap.Save((Join-Path $iconDirectory $spec.Name), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
} finally {
    $source.Dispose()
}
