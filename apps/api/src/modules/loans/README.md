# Loans Module

Manages loan facilities, amortization schedules, rate changes, and repayment tracking.

## Endpoints
- `POST /loans` — create a loan facility
- `GET /loans` — list loans with schedules and payments
- `POST /loans/payments` — record a principal/interest/fees repayment

## Features
- Supports TERM and REVOLVING loan types
- Schedule types: ANNUITY, INTEREST_ONLY, BALLOON, CUSTOM
- Fixed and variable rate tracking via LoanRate history
- Principal, interest, and fees split per payment

## Integration
- Loan schedules are generated separately (amortization engine)
- GL posting for repayments can be wired via the Posting module
