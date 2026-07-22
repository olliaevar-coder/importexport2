# Import / Export Discord Bot

A runnable **Discord.js v14** bot for collecting import/export orders and routing them through a staff review queue. Orders are persisted locally with **SQLite** via `better-sqlite3`.

## Features

- `/order` customer wizard using select menus, buttons, and pickup/destination modals
- Domestic or international shipment, cargo type, locations, route preference, and priority
- Customer may request the **cheapest suitable route** or choose their own valid route from Boat, Train, Plane, and combinations
- Staff queue sent to `STAFF_CHANNEL_ID` with route, payment, transit, and completion controls
- Route calculations for tariffs, company fee, total, and ETA
- SQLite persistence of all submitted orders and Discord message IDs
- Staff actions update both the original customer reply and the staff queue message
- Guild-only command deployment (no global command deployment)

## Requirements

- Node.js 18.17 or newer
- A Discord application/bot invited to the target guild with `bot` and `applications.commands` scopes
- In the staff channel, the bot needs View Channel, Send Messages, Embed Links, Read Message History, and Edit Messages permissions.

## Install and configure

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Purpose |
| --- | --- |
| `DISCORD_TOKEN` | Bot token |
| `CLIENT_ID` | Discord application ID |
| `GUILD_ID` | Target server ID; used for **guild-only** command deployment |
| `STAFF_CHANNEL_ID` | Channel ID that receives new staff orders |
| `STAFF_ROLE_IDS` | Optional comma-separated staff role IDs. If blank, staff controls require Manage Server. |

Do not commit `.env`. The generated `data/orders.sqlite` database is also ignored by Git.

## Deploy and run

Register the command to just the configured guild:

```bash
npm run deploy
```

Then start the bot:

```bash
npm start
```

For a local syntax-only check (does not need dependencies installed):

```bash
npm run check
```

## Customer order flow

1. Run `/order`.
2. Pick **Domestic** or **International**.
3. Pick cargo type.
4. Use the pickup-location modal.
5. Use the destination-location modal.
6. Choose either **Cheapest suitable route** or **Use my route choice**. The latter exposes a select menu with every valid route.
7. Choose priority. The order is stored and posted to the staff channel.

The available route values are `boat`, `train`, `plane`, `boat_plane`, `train_plane`, `boat_train`, and `boat_train_plane`.

### Route preference behavior

The bot does not attempt to infer a logistics route from locations. When a customer chooses *cheapest suitable route*, the staff embed explicitly tells staff to choose the lowest suitable route using their logistics judgement. When the customer selects their own route, that request is visible to staff; staff still chooses the operational route with the route button.

## Pricing and ETA rules

Each selected route sums its legs:

| Leg | Government tariff | Company fee | Base ETA |
| --- | ---: | ---: | ---: |
| Boat | 30,000 credits | 25,000 credits (Theo) | 45–60 days |
| Train | 50,000 credits | 40,000 credits (Theo) | 25–40 days |
| Plane | 70,000 credits | 50,000 credits (MJ) | 10–20 days |

- **Total** is government tariff plus company fee, represented as the project’s numeric `credits` amount. The original Theo/MJ source labels are retained in the table for individual leg company-fee rates.
- **Priority** adds 15,000 credits to the government tariff exactly once, regardless of route length.
- Priority reduces the summed ETA low and high bounds by 25%, rounded upward to whole days.

## Staff workflow

Staff members (Manage Server permission, or a role configured in `STAFF_ROLE_IDS`) use the staff-message buttons:

1. **Select route** shows all valid routes and calculates tariff, fee, total, and ETA.
2. **Mark paid** records payment.
3. **In transit** changes the status after a route has been selected.
4. **Complete** is enabled once the order is in transit.

All of these changes are written to SQLite and reflected in the customer’s original order message and the staff message. If an old Discord message was deleted or cannot be fetched, the database action still succeeds and the bot logs the message-refresh warning.

## Data model and project layout

- `index.js` — Discord client and interaction handlers
- `src/orders.js` — components, embeds, valid routes, and pricing/ETA calculation
- `src/database.js` — SQLite initialization and order CRUD
- `schema.sql` — complete SQL schema and indexes
- `data/orders.sqlite` — generated at first launch (ignored)
- `deploy-commands.js` — guild command registration

The database uses WAL mode and includes a small forward migration for the `requested_route` column.

## Notes

This project intentionally has no web service or external database dependency. Back up `data/orders.sqlite` when moving hosts. For production, use a process manager and restrict staff-channel access/roles appropriately.
