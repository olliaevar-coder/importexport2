# Verification report

Completed on 2026-07-22.

- Confirmed the project contains the requested bot entry point, guild command deployment script, SQLite schema/initialization, interaction handlers, environment template, package manifest, and documentation.
- Confirmed `schema.sql` defines the orders table and indexes, while `src/database.js` creates `data/` and initializes SQLite in WAL mode.
- Confirmed route definitions include all seven requested route combinations. Calculation logic sums leg tariff, company fee, and ETA; applies the one-time 15,000 priority tariff and 25% ETA reduction.
- Ran successfully:

```text
node --check index.js
node --check deploy-commands.js
node --check src/database.js
node --check src/orders.js
```

No dependencies were installed and no Discord API calls were made during verification.
