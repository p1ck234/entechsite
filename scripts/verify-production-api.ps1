$baseUrl = "https://entechsite-backend-production.up.railway.app"

Write-Host "=== EnTech backend probe ===" -ForegroundColor Cyan

$health = curl.exe -s "$baseUrl/health" | ConvertFrom-Json
Write-Host "Health:" ($health | ConvertTo-Json -Compress)
if ($health.features) {
  Write-Host "Features:" ($health.features -join ", ")
} else {
  Write-Host "WARN: features missing in /health — backend likely OLD build" -ForegroundColor Yellow
}

$checks = @(
  @{ Method = "GET"; Path = "/api/org-structure/tree"; Note = "org-structure" },
  @{ Method = "GET"; Path = "/api/employees/org-tree"; Note = "employees org-tree" },
  @{ Method = "PATCH"; Path = "/api/employees/1/manager"; Note = "manager patch"; Body = '{"managerId":null}' }
)

foreach ($check in $checks) {
  $url = "$baseUrl$($check.Path)"
  if ($check.Method -eq "PATCH") {
    $raw = curl.exe -s -w "`nHTTP:%{http_code}" -X PATCH $url -H "Content-Type: application/json" --data-binary $check.Body
  } else {
    $raw = curl.exe -s -w "`nHTTP:%{http_code}" $url
  }

  $lines = $raw -split "`n"
  $status = $lines[-1]
  $body = ($lines[0..($lines.Length - 2)] -join "`n")
  Write-Host ""
  Write-Host "$($check.Note): $status" -ForegroundColor $(if ($status -match '404') { 'Red' } elseif ($status -match '401|403') { 'Green' } else { 'Yellow' })
  Write-Host $body
}

Write-Host ""
Write-Host "Ожидание после redeploy:" -ForegroundColor Cyan
Write-Host "- /health содержит features: employees-manager-patch"
Write-Host "- PATCH /api/employees/1/manager -> 401 или 403 (не 404)"
