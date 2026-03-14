#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:3000}
EMAIL=${EMAIL:-admin@example.com}
PASSWORD=${PASSWORD:-Admin123!}

json() { jq -c -n "$1"; }

echo "Logging in..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" -d "$(json --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e, password:$p}')" | jq -r .token)
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

echo "Health" && curl -s "$BASE_URL/api/v1/health" >/dev/null

echo "Product" && curl -s -X POST "$BASE_URL/api/v1/inventory/products" "${AUTH[@]}" -d "$(json '{name:"Widget", sku:"W-1"}')" >/dev/null
echo "Warehouse" && curl -s -X POST "$BASE_URL/api/v1/inventory/warehouses" "${AUTH[@]}" -d "$(json '{name:"Main", branchId:1}')" >/dev/null
echo "Stock IN" && curl -s -X POST "$BASE_URL/api/v1/inventory/stock-movements" "${AUTH[@]}" -d "$(json '{productId:1, warehouseId:1, quantity:10, direction:"IN", reference:"init"}')" >/dev/null

echo "Sales invoice" && curl -s -X POST "$BASE_URL/api/v1/sales/invoices" "${AUTH[@]}" -d "$(json '{customerId:1, date:"2026-03-12", items:[{productId:1, quantity:1, unitPrice:100, taxRate:7.5}]}')" >/dev/null

echo "Purchase bill" && curl -s -X POST "$BASE_URL/api/v1/purchases/bills" "${AUTH[@]}" -d "$(json '{supplierId:1, date:"2026-03-12", items:[{productId:1, quantity:2, unitCost:50, taxRate:7.5}]}')" >/dev/null

echo "Fixed asset category" && curl -s -X POST "$BASE_URL/api/v1/fixed-assets/categories" "${AUTH[@]}" -d "$(json '{name:"Laptops", usefulLifeMonths:36, depreciationMethod:"STRAIGHT_LINE"}')" >/dev/null
echo "Fixed asset" && curl -s -X POST "$BASE_URL/api/v1/fixed-assets/assets" "${AUTH[@]}" -d "$(json '{name:"MBP", tag:"FA-001", categoryId:1, acquisitionDate:"2026-03-01", acquisitionCost:1800}')" >/dev/null
echo "Depreciation run" && curl -s -X POST "$BASE_URL/api/v1/depreciation/runs" "${AUTH[@]}" -d "$(json '{periodStart:"2026-03-01", periodEnd:"2026-03-31"}')" >/dev/null

echo "Loan create" && curl -s -X POST "$BASE_URL/api/v1/loans" "${AUTH[@]}" -d "$(json '{code:"LN-001", lender:"Bank", type:"TERM", principal:10000, startDate:"2026-03-01", scheduleType:"ANNUITY"}')" >/dev/null
echo "Loan payment" && curl -s -X POST "$BASE_URL/api/v1/loans/payments" "${AUTH[@]}" -d "$(json '{loanId:1, paymentDate:"2026-03-12", principalPaid:500, interestPaid:50}')" >/dev/null

echo "Smoke completed"
