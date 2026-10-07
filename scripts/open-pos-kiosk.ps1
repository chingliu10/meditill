param(
  [Parameter(Mandatory = $true)]
  [uri]$Url,
  [switch]$PrintCommand
)

$ErrorActionPreference = 'Stop'
if ($Url.Scheme -notin @('http', 'https') -or -not $Url.IsAbsoluteUri -or $Url.UserInfo) {
  throw 'Supply an absolute HTTP(S) POS URL without embedded credentials.'
}

$edge = Get-Command 'msedge.exe' -ErrorAction SilentlyContinue
$edgePath = if ($edge) { $edge.Source } else { $null }
if (-not $edgePath) {
  foreach ($base in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
    if (-not $base) { continue }
    $candidate = Join-Path $base 'Microsoft\Edge\Application\msedge.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $edgePath = $candidate
      break
    }
  }
}
if (-not $edgePath) { throw 'Microsoft Edge was not found on this PC.' }

$arguments = @('--kiosk', ('"' + $Url.AbsoluteUri + '"'), '--edge-kiosk-type=fullscreen', '--no-first-run')
if ($PrintCommand) {
  Write-Output ('"' + $edgePath + '" ' + ($arguments -join ' '))
  return
}

# This is an interactive cashier window, not a background service.
Start-Process -FilePath $edgePath -ArgumentList $arguments
