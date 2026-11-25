# Token Radar — token-radar-01 entry

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sage-walrus-22-1544/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sage-walrus-22-1544/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Entry for make.fun **“Build the best token launch radar”**
(bounty [`token-radar-01`](https://make.fun/bounty/token-radar-01), $1,325 across
the top 10, closes **2026-12-14 10:00 UTC**).

A token launch radar for the make.fun `token-radar-01` bounty. The program
reads the sealed DefiLlama snapshot (`/input/snapshot.json`), ranks **every**
protocol that records no token (CoinGecko id and symbol both null) by an
implied launch value, and writes a static dashboard a reader can use.

## The value model (radar-5)

Every figure is computed from the snapshot at run time; no protocol is
hand-valued.

1. **Peer multiple** — for tokenized protocols, ratio = market cap / TVL.
   Per category the model takes the **median** ratio of that category's
   tokenized peers (categories with fewer than 3 peers, or none, fall back
   to the global median), clamped to [0.02, 3].
2. **Base** = TVL × category multiple.
3. **Adjustments** — 7-day TVL momentum (×0.83–1.35), maturity from how
   long the protocol has run while recording no token (×0.75–1.25, age
   from `listed_at` to the snapshot's `as_of`), and chain breadth
   (+3% per extra chain, up to +21%).
4. **Launch plausibility** — some protocols that record no token are not
   pre-token launches at all: their value already trades through a
   parent token or business. The model reuses the watchlist rule's own
   exclusions (see the kit's `input/README.md`): a category of `Bridge`,
   `Canonical Bridge`, `Liquid Staking`, `Liquid Restaking`,
   `Restaked BTC` or `CEX`; a name ending in a version marker; a name
   carrying the whole word *wrapped*, *staked* or *staking*; or a name
   beginning with an exchange's name (Binance, Coinbase, Bybit, Kraken,
   Bitget, OKX, Bitfinex, Gemini). Such a protocol stays on the board —
   it is coverage, and the dashboard badges it TRADES BY PROXY — but its
   implied value is multiplied by **0.04** and its model breakdown
   states the factor and the reason (e.g. *wrapped product: value trades
   via parent token*). Every other protocol keeps a factor of 1.
5. **Ranking** — by implied value, then TVL, then slug; ties are nudged
   down $1 at a time so values strictly follow rank order.

Each board row also carries a five-step farm plan generated from the
protocol's own category, working chain, TVL tier and age — the action the
category implies, a capital tier, a weekly cadence, a holding window, and
claim hygiene. Radar-5 costs every plan from two stated tables instead of
one flat gas figure: a **per-chain cost table** (what one transaction
costs on the working chain — about $4.50 on Ethereum, $0.08 on Base,
$0.02 on Solana — what funding a fresh wallet there costs, and which
asset the wallet holds for gas) and a **per-action transaction count**
(a lending loop is supply + borrow + re-supply = 3 transactions, an EVM
vault deposit is approve + deposit = 2, a Solana deposit is 1, an
exchange account is 0 because it charges on trades instead). Fees that
are not gas are counted too: a bridge's ~0.1% fee, an insurance
premium of ~2% of cover, an exchange's ~$1 a week of trading fees. Each
step states its own cost and time from those figures — including how
the position closes (a lending loop needs repay-then-withdraw, an
optimistic rollup's canonical bridge back to Ethereum waits out a
~7-day fraud-proof window, staking withdrawals queue) — and each row
adds up the plan's totals (capital, fees across the holding window,
setup minutes, minutes a week) in a `farm_summary` the dashboard shows
as the plan at a glance. The working chain is the first listed chain
that is not Bitcoin (DefiLlama lists Bitcoin first for many bridges
and exchanges, and USDC cannot move on Bitcoin); a protocol listed
only on Bitcoin gets steps phrased as holding or bridging BTC from a
Bitcoin wallet instead, priced at Bitcoin network fees. Plans say a
protocol *records no token yet*; they never claim it has none.

## Run it

```
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22.18+, standard library only. `--input` (or `$MAKEFUN_INPUT`) and
`--output` (or `$MAKEFUN_OUTPUT_DIR`) override the sealed defaults
`/input/snapshot.json` and `/output`. The program writes `board.json`,
`data.js`, `dashboard/`, `screenshots/` and `dossier.json` (built with
`vendor/makefun-board.ts`, shipped byte for byte from the kit) into the
output directory. Runs are deterministic: same snapshot, same bytes.

## Layout

- `main.ts` — the entrypoint: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the value model, the board builder and the farm plans.
- `dashboard/` — the static page (no network): methodology, the sortable /
  filterable board, an early-radar momentum section, a per-protocol detail
  view, and the live-token peer set kept apart from the ranking.
- `screenshots/` — screenshots of the dashboard (board, detail, filtered).
- `vendor/makefun-board.ts` — make.fun's dossier library, unmodified.

## License

MIT — see `LICENSE`.
