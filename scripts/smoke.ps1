param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "admin@example.com",
  [string]$Password = "Admin123!"
)

function CallJson($method, $url, $body, $token) {
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $json = if ($body) { ($body | ConvertTo-Json -Depth 6) } else { $null }
  Invoke-RestMethod -Method $method -Uri $url -Headers $headers -Body $json -ErrorAction Stop
}

Write-Host "Logging in..."
$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -Headers @{ 'Content-Type'='application/json' } -Body (@{ email=$Email; password=$Password } | ConvertTo-Json)
$TOKEN = $login.token
Write-Host "Token acquired"

Write-Host "Health"; Invoke-RestMethod "$BaseUrl/api/v1/health" | Out-Null

Write-Host "Product"; CallJson Post "$BaseUrl/api/v1/inventory/products" @{ name="Widget"; sku="W-1" } $TOKEN | Out-Null
Write-Host "Warehouse"; CallJson Post "$BaseUrl/api/v1/inventory/warehouses" @{ name="Main"; branchId=1 } $TOKEN | Out-Null
Write-Host "Stock IN"; CallJson Post "$BaseUrl/api/v1/inventory/stock-movements" @{ productId=1; warehouseId=1; quantity=10; direction="IN"; reference="init" } $TOKEN | Out-Null

Write-Host "Sales invoice"; CallJson Post "$BaseUrl/api/v1/sales/invoices" @{ customerId=1; date="2026-03-12"; items=@(@{ productId=1; quantity=1; unitPrice=100; taxRate=7.5 }) } $TOKEN | Out-Null

Write-Host "Purchase bill"; CallJson Post "$BaseUrl/api/v1/purchases/bills" @{ supplierId=1; date="2026-03-12"; items=@(@{ productId=1; quantity=2; unitCost=50; taxRate=7.5 }) } $TOKEN | Out-Null

Write-Host "Fixed asset category"; CallJson Post "$BaseUrl/api/v1/fixed-assets/categories" @{ name="Laptops"; usefulLifeMonths=36; depreciationMethod="STRAIGHT_LINE" } $TOKEN | Out-Null
Write-Host "Fixed asset"; CallJson Post "$BaseUrl/api/v1/fixed-assets/assets" @{ name="MBP"; tag="FA-001"; categoryId=1; acquisitionDate="2026-03-01"; acquisitionCost=1800 } $TOKEN | Out-Null
Write-Host "Depreciation run"; CallJson Post "$BaseUrl/api/v1/depreciation/runs" @{ periodStart="2026-03-01"; periodEnd="2026-03-31" } $TOKEN | Out-Null

Write-Host "Loan create"; CallJson Post "$BaseUrl/api/v1/loans" @{ code="LN-001"; lender="Bank"; type="TERM"; principal=10000; startDate="2026-03-01"; scheduleType="ANNUITY" } $TOKEN | Out-Null
Write-Host "Loan payment"; CallJson Post "$BaseUrl/api/v1/loans/payments" @{ loanId=1; paymentDate="2026-03-12"; principalPaid=500; interestPaid=50 } $TOKEN | Out-Null

Write-Host "Smoke completed"
