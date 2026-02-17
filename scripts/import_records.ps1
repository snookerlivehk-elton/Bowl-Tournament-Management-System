param(
  [string]$ZipPath = "$env:USERPROFILE\\Desktop\\BB_openclaw.zip",
  [string]$ProjectRoot = "C:\\Users\\User\\.trae\\openclaw-records"
)
$ErrorActionPreference = "Stop"
$dest = Join-Path $ProjectRoot "import\\BB_openclaw"
$out = Join-Path $ProjectRoot "data\\records.json"
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
if (!(Test-Path -Path $ZipPath)) {
  Write-Output "ZIP not found: $ZipPath"
  exit 1
}
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $dest -Force
$include = @('*.json','*.csv','*.txt','*.md')
$exclude = @('*api*','*config*','*.env*','*secret*','*key*','*setting*')
$files = @()
foreach ($pattern in $include) {
  $files += Get-ChildItem -Path $dest -Recurse -File -Include $pattern
}
$filtered = @()
foreach ($f in $files) {
  $skip = $false
  foreach ($ex in $exclude) {
    if ($f.Name -like $ex -or $f.FullName -like $ex) { $skip = $true; break }
  }
  if (-not $skip) { $filtered += $f }
}
$map = @{}
foreach ($f in $filtered) {
  $rel = $f.FullName.Substring($dest.Length).TrimStart('\')
  $content = Get-Content -Path $f.FullName -Raw
  if ($null -eq $content) { $content = "" }
  $secretKeyPatterns = @(
    '(?i)(api[_-]?key\\s*[:=]\\s*)(\"?[A-Za-z0-9\\-\\._~+/=]+\"?)',
    '(?i)(client[_-]?secret\\s*[:=]\\s*)(\"?[A-Za-z0-9\\-\\._~+/=]+\"?)',
    '(?i)(client[_-]?id\\s*[:=]\\s*)(\"?[A-Za-z0-9\\-\\._~+/=]+\"?)',
    '(?i)(secret\\s*[:=]\\s*)(\"?[A-Za-z0-9\\-\\._~+/=]+\"?)',
    '(?i)(token\\s*[:=]\\s*)(\"?[A-Za-z0-9\\-\\._~+/=]+\"?)',
    '(?i)(password\\s*[:=]\\s*)(\"?[A-Za-z0-9\\-\\._~+/=]+\"?)'
  )
  foreach ($pat in $secretKeyPatterns) {
    $content = [regex]::Replace($content, $pat, '${1}\"[REDACTED]\"')
  }
  $content = [regex]::Replace($content, '(?i)Bearer\\s+[A-Za-z0-9\\-\\._~+/=]+', 'Bearer [REDACTED]')
  $content = [regex]::Replace($content, '(?i)(xai|openai|openrouter)\\s*api\\s*key', '[REDACTED API KEY]')
  $map[$rel] = $content
}
$obj = @{ records = $map }
$json = $obj | ConvertTo-Json -Depth 5
Set-Content -Path $out -Value $json -Encoding UTF8
Write-Output "Wrote records to $out"
