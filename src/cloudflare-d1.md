---
description: rules
globs: 
alwaysApply: false
---

# Cloudflare D1

- Transactions are not supported (D1 limitation)
- Avoid complex JOIN queries and adopt denormalized design patterns
- Remove junction tables and aggregate data into JSON columns
- Embed related data in the same table instead of using separate tables
- Pre-calculate and store computed values (totals, counts, etc.)
- Use Drizzle service layer instead of stored procedures
- Use Drizzle lifecycle hooks instead of database triggers
- Split large data processing into smaller batches to avoid timeouts
- Cache frequently accessed data using Cloudflare KV
