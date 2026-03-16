# Bulk Import Templates

These files are generated from the ERP import contract.

## File types
- `.csv` files contain the exact headers expected by the importer.
- `.schema.json` files describe data type, required flag, and database mapping.

## Data rules
- `string`: plain text
- `integer`: whole number
- `decimal`: numeric value with or without decimals
- `boolean`: TRUE or FALSE
- `date`: ISO format, for example `2026-01-31`

## Notes
- Keep headers unchanged.
- Do not merge cells.
- Do not add extra columns.
- Use one journal number per balanced journal in `gl-journal-dump.csv`.
- Use one branch and one currency per journal in `gl-journal-dump.csv`.
