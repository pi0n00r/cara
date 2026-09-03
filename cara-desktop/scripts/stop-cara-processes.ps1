# AI-NOTICE:Schema-Version=0.1
# AI-NOTICE:License=MIT
# AI-NOTICE:Author=Gary Bajaj
# AI-NOTICE:Scope=file

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir,

  [Parameter(Mandatory = $true)]
  [string]$StorageDir
)

$ErrorActionPreference = 'Stop'

function Normalize-DirectoryPrefix([string]$Path) {
  return ([IO.Path]::GetFullPath($Path).TrimEnd('\') + '\').ToLowerInvariant()
}

function Normalize-ProcessText([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
  return $Value.Replace('/', '\').ToLowerInvariant()
}

$installPrefix = Normalize-DirectoryPrefix $InstallDir
$providerPrefix = Normalize-DirectoryPrefix (Join-Path $StorageDir 'providers')
$targets = @()

foreach ($process in @(Get-CimInstance Win32_Process)) {
  if ($process.ProcessId -eq $PID) { continue }

  $name = Normalize-ProcessText ([string]$process.Name)
  $executable = Normalize-ProcessText ([string]$process.ExecutablePath)
  $commandLine = Normalize-ProcessText ([string]$process.CommandLine)

  $isInstalledRuntime = $executable.StartsWith($installPrefix)
  $isProviderSidecar =
    ($name -eq 'node.exe' -or $name -eq 'node') -and
    $commandLine.Contains($providerPrefix)

  if ($isInstalledRuntime -or $isProviderSidecar) {
    $targets += $process
  }
}

foreach ($process in $targets) {
  & "$env:SystemRoot\System32\taskkill.exe" /PID $process.ProcessId /T /F *> $null
  if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue)) {
    throw "Unable to stop Cara-owned process $($process.ProcessId) ($($process.Name))"
  }
}

$deadline = [DateTime]::UtcNow.AddSeconds(15)
do {
  $remaining = @(
    $targets | Where-Object {
      Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
    }
  )
  if ($remaining.Count -eq 0) { exit 0 }
  Start-Sleep -Milliseconds 250
} while ([DateTime]::UtcNow -lt $deadline)

$ids = ($remaining | ForEach-Object ProcessId) -join ', '
throw "Cara-owned processes did not exit: $ids"
