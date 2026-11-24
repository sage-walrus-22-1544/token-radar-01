// Token Radar model v4: one sealed snapshot in, one ranked board out.
// (v4 adds a computed plan summary - capital, fees over the holding
// window, minutes a week - to every row's farm plan; values unchanged.)
//
// The board ranks EVERY protocol in the snapshot that records no token
// (gecko_id and symbol both null) - the watchlist's 40 large protocols and
// the few hundred smaller ones below its $50M floor alike. Protocols whose
// token already trades are never ranked; they are the model's teachers and
// the dashboard's live comparison set.
//
// Implied value is derived from the snapshot itself, in four stated steps:
//
//   1. Peer multiple. For every tokenized protocol, ratio = mcap_usd / tvl_usd.
//      Per category, the model's multiple is the MEDIAN ratio of that
//      category's tokenized peers (robust to outliers such as wrappers whose
//      market cap dwarfs their TVL). A category with fewer than MIN_PEERS
//      tokenized peers, or none, falls back to the global median ratio.
//      The multiple is clamped to [RATIO_FLOOR, RATIO_CAP].
//   2. Base value. base = tvl_usd x category multiple.
//   3. Adjustments, each a stated factor of the snapshot's own figures:
//        momentum  = 1 + clamp(change_7d, -50, 100)/100 x 0.35 (null -> 1)
//        maturity  = 0.75 + 0.5 x min(age_days, 1460)/1460, age measured
//                    from listed_at to the snapshot's as_of (unknown -> 0.9):
//                    a protocol that has run longer with no token recorded
//                    carries a larger, more established TVL base.
//        breadth   = 1 + 0.03 x min(chains - 1, 7): multi-chain reach.
//      implied = round(base x momentum x maturity x breadth), at least $1.
//   4. Launch plausibility. Some records-no-token protocols are not
//      pre-token launches at all: their value already trades through a
//      parent token or business. The model reuses the watchlist rule's
//      own exclusions (the kit's input/README.md): a category of Bridge,
//      Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC
//      or CEX; a name ending in a version marker; a name carrying the
//      whole word wrapped, staked or staking; or a name beginning with
//      an exchange's name (Binance, Coinbase, Bybit, Kraken, Bitget,
//      OKX, Bitfinex, Gemini). Such a protocol stays on the board - it
//      is coverage, and a reader should see it - but its implied value
//      is multiplied by PLAUSIBILITY_FACTOR (0.04) and its row states
//      the reason. Everything else keeps a factor of 1.
//   5. Ranking. Rows sort by implied value, then TVL, then slug; a final
//      pass nudges any tied value down by $1 steps so values never rise
//      as rank ascends and the ordering is strict and deterministic.
//
// No protocol name is ever special-cased and no number is hand-typed per
// protocol: change the snapshot and every figure moves.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export const MODEL_VERSION = 'radar-4';

/** Categories need at least this many tokenized peers before their own median is trusted. */
export const MIN_PEERS = 3;
/** The peer multiple is clamped into this band before it is applied. */
export const RATIO_FLOOR = 0.02;
export const RATIO_CAP = 3;
/** Momentum: weight and clamp for the 7-day TVL change, in per cent. */
export const MOMENTUM_WEIGHT = 0.35;
export const MOMENTUM_FLOOR = -50;
export const MOMENTUM_CAP = 100;
/** Maturity: floor, range and the age (days) at which the range is fully earned. */
export const MATURITY_FLOOR = 0.75;
export const MATURITY_RANGE = 0.5;
export const MATURITY_DAYS = 1460;
export const UNKNOWN_MATURITY = 0.9;
/** Breadth: per extra chain, and how many extra chains count. */
export const BREADTH_PER_CHAIN = 0.03;
export const BREADTH_MAX_EXTRA = 7;
/** Launch plausibility: the factor applied to a proxy product's implied value. */
export const PLAUSIBILITY_FACTOR = 0.04;
/** Categories the watchlist rule treats as products of another token, never as launches of their own. */
export const PROXY_CATEGORIES: ReadonlySet<string> = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);
/** A name ending in a version marker: a space, then V2, v2, 2.0 or the like (the watchlist rule's own pattern). */
export const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** The whole words that mark a wrapped or staked product of another token, in any case. */
export const PROXY_WORD = /\b(wrapped|staked|staking)\b/i;
/** Exchange names a product's name may begin with (the watchlist rule's list). */
export const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** The peer statistics the model derived from one snapshot, stated for the dashboard. */
export interface PeerStats {
  global_ratio: number;
  tokenized_peers: number;
  by_category: Record<string, { peers: number; ratio: number }>;
}

/** A farm plan's totals, added up from the same figures its steps state. */
export interface FarmSummary {
  capital_usd: number;
  fees_usd: number;
  setup_minutes: number;
  weekly_minutes: number;
  hold_days: number;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'records-no-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_ratio: number;
    ratio_source: 'category' | 'global';
    category_peers: number;
    momentum_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    plausibility_factor: number;
    plausibility_reason: string | null;
  };
  farm_steps: string[];
  farm_summary: FarmSummary;
}

/** A live-token protocol: already trades, shown with the market's own value, never ranked. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  ratio: number | null;
}

/** A compact board row for the dashboard's data.js, farm plan included verbatim. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  category_ratio: number;
  ratio_source: 'category' | 'global';
  momentum_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  plausibility_factor: number;
  plausibility_reason: string | null;
  farm_steps: string[];
  farm_summary: FarmSummary;
}

/** Everything the dashboard renders. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model_summary: string;
  scanned: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  total_implied_usd: number;
  total_tvl_usd: number;
  peers: PeerStats;
  rows: RadarRow[];
  early: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Median of a non-empty list (sorted copy; the list itself is untouched). */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** A whole day count from listed_at to as_of, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token: DefiLlama carries neither a CoinGecko id nor a symbol for it. */
export function recordsNoToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/**
 * Launch plausibility: is this records-no-token protocol plausibly waiting
 * on a launch of its own, or does its value already trade by proxy through
 * a parent token or business? The tests are the watchlist rule's own
 * exclusions, reused from the kit's input/README.md - no name is
 * special-cased beyond the rule the house itself published. A proxy
 * product keeps its board row but is valued at PLAUSIBILITY_FACTOR of
 * its model value, and the row carries the reason in plain words.
 */
export function plausibility(p: SnapshotProtocol): { factor: number; reason: string | null } {
  const category = p.category ?? '';
  if (PROXY_CATEGORIES.has(category)) {
    if (category === 'CEX') {
      return { factor: PLAUSIBILITY_FACTOR, reason: 'exchange: a trading venue whose value sits in the business, not a pre-token protocol launch' };
    }
    if (category === 'Bridge' || category === 'Canonical Bridge') {
      return { factor: PLAUSIBILITY_FACTOR, reason: 'bridge product: value trades via the assets it moves, not a token of its own' };
    }
    return { factor: PLAUSIBILITY_FACTOR, reason: 'staking product: value trades via the underlying staked asset' };
  }
  if (VERSION_SUFFIX.test(p.name)) {
    return { factor: PLAUSIBILITY_FACTOR, reason: 'versioned product: a later version of a protocol whose value already trades via the original' };
  }
  const word = PROXY_WORD.exec(p.name);
  if (word !== null) {
    return { factor: PLAUSIBILITY_FACTOR, reason: `${word[1]!.toLowerCase()} product: value trades via parent token` };
  }
  for (const exchange of EXCHANGE_PREFIXES) {
    if (p.name === exchange || p.name.startsWith(`${exchange} `)) {
      return { factor: PLAUSIBILITY_FACTOR, reason: 'exchange-branded product: value trades via the exchange behind it' };
    }
  }
  return { factor: 1, reason: null };
}

/** The peer multiples of one snapshot: a median mcap/TVL per category and one global median. */
export function peerStats(snapshot: Snapshot): PeerStats {
  const ratiosByCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? 'Uncategorised';
    const list = ratiosByCategory.get(key) ?? [];
    list.push(ratio);
    ratiosByCategory.set(key, list);
  }
  const by_category: Record<string, { peers: number; ratio: number }> = {};
  for (const [key, list] of [...ratiosByCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    by_category[key] = { peers: list.length, ratio: round4(clamp(median(list), RATIO_FLOOR, RATIO_CAP)) };
  }
  return {
    global_ratio: all.length > 0 ? round4(clamp(median(all), RATIO_FLOOR, RATIO_CAP)) : 0.25,
    tokenized_peers: all.length,
    by_category,
  };
}

/** The multiple one protocol is valued at, and where it came from. */
function multipleFor(p: SnapshotProtocol, peers: PeerStats): { ratio: number; source: 'category' | 'global'; count: number } {
  const entry = p.category === null ? undefined : peers.by_category[p.category];
  if (entry !== undefined && entry.peers >= MIN_PEERS) return { ratio: entry.ratio, source: 'category', count: entry.peers };
  return { ratio: peers.global_ratio, source: 'global', count: entry?.peers ?? 0 };
}

/** The adjustment factors, the plausibility classification and the implied value of one pre-token protocol. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  peers: PeerStats,
): { implied: number; age: number | null; ratio: number; source: 'category' | 'global'; peers: number; momentum: number; maturity: number; breadth: number; plausibility_factor: number; plausibility_reason: string | null } {
  const age = ageDays(asOf, p.listed_at);
  const { ratio, source, count } = multipleFor(p, peers);
  const growth = p.change_7d === null ? 0 : clamp(p.change_7d, MOMENTUM_FLOOR, MOMENTUM_CAP);
  const momentum = p.change_7d === null ? 1 : 1 + (growth / 100) * MOMENTUM_WEIGHT;
  const maturity = age === null ? UNKNOWN_MATURITY : MATURITY_FLOOR + (Math.min(age, MATURITY_DAYS) / MATURITY_DAYS) * MATURITY_RANGE;
  const breadth = 1 + BREADTH_PER_CHAIN * Math.min(Math.max(p.chains.length - 1, 0), BREADTH_MAX_EXTRA);
  const proxy = plausibility(p);
  const implied = Math.max(1, Math.round(p.tvl_usd * ratio * momentum * maturity * breadth * proxy.factor));
  return { implied, age, ratio, source, peers: count, momentum, maturity, breadth, plausibility_factor: proxy.factor, plausibility_reason: proxy.reason };
}

// ---------------------------------------------------------------- farm plans

/**
 * The chain a farm plan should actually work on. DefiLlama lists Bitcoin
 * first for many protocols whose usable product lives elsewhere (bridges
 * and exchanges above all), and "bridge USDC from Bitcoin" is an action
 * nobody can take: USDC does not move on Bitcoin. So the working chain is
 * the first listed chain that is not Bitcoin. Only a protocol whose every
 * listed chain is Bitcoin is bitcoinOnly, and its steps are phrased as
 * holding or bridging BTC from a Bitcoin wallet instead.
 */
export function workingChain(p: SnapshotProtocol): { chain: string; bitcoinOnly: boolean } {
  const elsewhere = p.chains.find((c) => c !== 'Bitcoin');
  if (elsewhere !== undefined) return { chain: elsewhere, bitcoinOnly: false };
  if (p.chains.length > 0) return { chain: 'Bitcoin', bitcoinOnly: true };
  return { chain: 'its main chain', bitcoinOnly: false };
}
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 25_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The weekly repeat action for a category, in words a farmer can follow. */
function weeklyFor(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) return 'repay and re-borrow a small amount, or top up the supply position';
  if (c.includes('dex')) return 'make two swaps through the main pool and rebalance the liquidity range';
  if (c.includes('bridge')) return 'bridge a small amount back or forth so both directions are on record';
  if (c.includes('staking') || c.includes('restak')) return 'claim any rewards and restake them so the balance keeps compounding';
  if (c.includes('derivative') || c.includes('perpetual')) return 'open and close one small hedged trade to keep volume on record';
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator')) return 'harvest the vault yield and redeposit it into the same vault';
  return 'repeat the core deposit action with a small amount so the week counts as active';
}

/** The core qualifying action for a protocol, from its category and working chain. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string, bitcoinOnly: boolean): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (bitcoinOnly) {
    if (c.includes('bridge') || c.includes('canonical')) return `Send $${capital} of BTC from your Bitcoin wallet through ${n}'s deposit address and hold the bridged BTC it issues on the destination chain; the deposit is the activity the bridge records`;
    if (c.includes('staking') || c.includes('restak')) return `Commit $${capital} of BTC from your Bitcoin wallet to ${n}'s staking product and leave the BTC in place for the full holding window`;
    return `Move $${capital} of BTC from your Bitcoin wallet into ${n} on Bitcoin and keep the position there, untouched, for the holding window`;
  }
  if (c.includes('lend')) return `Supply $${capital} of USDC to ${n} on ${chain}, then borrow about 40% against it and supply the borrow back, so both sides of the market carry your activity`;
  if (c.includes('cdp')) return `Deposit $${capital} of collateral into ${n} on ${chain} and mint a modest amount of its stablecoin against it, keeping the collateral ratio comfortably above liquidation`;
  if (c.includes('dex')) return `Add $${capital} of two-sided liquidity to ${n}'s highest-TVL pool on ${chain} and make two small swaps through the same pool in the first week`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC from ${chain} to the protocol's busiest destination chain through ${n}, then use the bridged funds in one app on the far side`;
  if (c.includes('canonical')) return `Bridge $${capital} of ETH or USDC to ${chain} through ${n}'s canonical bridge and hold the bridged asset in the receiving wallet`;
  if (c.includes('liquid staking')) return `Stake $${capital} of the chain's native asset through ${n} on ${chain} and hold the liquid staking receipt token in the same wallet`;
  if (c.includes('restak')) return `Restake $${capital} of a liquid staking token through ${n} on ${chain} and keep the restaked position untouched while it accrues points`;
  if (c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${n} on ${chain} and leave the position delegated for the full holding window`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Deposit $${capital} of USDC margin on ${n} (${chain}) and run one small hedged position a week, sized so liquidation is never close`;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} of USDC into a curated vault on ${n} (${chain}) and keep the vault shares; curated vaults are where allocator points usually accrue`;
  if (c.includes('yield aggregator')) return `Deposit $${capital} of USDC into ${n}'s main auto-compounding vault on ${chain} and keep the vault shares for the whole window`;
  if (c.includes('yield')) return `Deposit $${capital} of USDC into ${n}'s main yield vault on ${chain} and keep the position while the yield compounds`;
  if (c.includes('rwa')) return `Mint $${capital} of ${n}'s tokenised real-world-asset product on ${chain} after its onboarding checks, and hold the asset to term`;
  if (c.includes('cex')) return `Open an account on ${n}, complete its verification, deposit $${capital} and make a few spot trades a week on its main pairs; exchange points programmes reward steady volume`;
  if (c.includes('basis')) return `Open ${n}'s basis position with $${capital} of USDC on ${chain}: the protocol pairs the spot and perpetual legs, so fund it and let the pair run`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${n} on ${chain} and hold it in the farming wallet`;
  if (c.includes('insurance')) return `Buy $${capital} of protocol cover from ${n} on ${chain} and keep the policy active for the holding window`;
  if (c.includes('prediction')) return `Fund $${capital} on ${n} and hold one position in its most liquid market on ${chain}`;
  if (c.includes('privacy')) return `Deposit $${capital} into ${n}'s shielded pool on ${chain} and make one shielded transfer, following the protocol's own compliance guidance`;
  if (c.includes('index')) return `Buy $${capital} of ${n}'s main index product on ${chain} and hold the index token in the farming wallet`;
  return `Deposit $${capital} of USDC into ${n} on ${chain} through its main product page and keep the position open for the holding window`;
}

/**
 * A protocol's farm plan: five concrete steps derived from its own record -
 * its working chain, its category's action, its TVL tier's capital, its age's
 * holding window - each with a cost and a time. The plan says the protocol
 * records no token yet; it never claims the protocol has none.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const { chain, bitcoinOnly } = workingChain(p);
  const second = p.chains.find((c) => c !== chain && c !== 'Bitcoin') ?? null;
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 250 ? 10 : capital >= 150 ? 6 : 4;
  const steps = [
    bitcoinOnly
      ? `Set up a fresh Bitcoin wallet for ${p.name}, fund it with about $${capital + 25} of BTC, and keep the seed phrase offline; ${p.name} records no token yet, so this wallet is your eligibility record. Cost: about $${gas} of network fees to fund. Time: 10 minutes.`
      : `Set up a fresh wallet for ${p.name} on ${chain}, fund it with $${capital + 25} of USDC plus gas, and keep the seed phrase offline; ${p.name} records no token yet, so this wallet is your eligibility record. Cost: about $${gas} of gas to fund. Time: 10 minutes.`,
    `${actionFor(p, capital, chain, bitcoinOnly)}. Cost: $${capital} of capital and about $${gas} of ${bitcoinOnly ? 'network fees' : 'gas'}. Time: 15-20 minutes to set up.`,
    `Return once a week and ${weeklyFor(p.category)}; steady weekly activity over ${hold} days counts for more than one large deposit. Cost: about $2 of ${bitcoinOnly ? 'network fees' : 'gas'} a week. Time: 10 minutes a week.`,
    `Hold the position for at least ${hold} days without withdrawing below the starting amount, so the activity spans several weekly snapshots. Cost: the $${capital} stays in the position. Time: ${hold} days.`,
    `Every Sunday, check ${p.name}'s own points, rewards or governance page${second === null ? '' : ` (it also runs on ${second}; activity there counts from the same wallet)`} and screenshot your balance; claim only from a link the protocol itself publishes, and never pay a fee to claim. Cost: nothing to check. Time: 5 minutes a week.`,
  ];
  return steps.map((s) => (s.length > 600 ? `${s.slice(0, 596)}...` : s));
}

/**
 * The plan's totals, from the same figures farmSteps states: the capital
 * stays in the position; the fees are the funding gas, the setup gas and
 * $2 a week of repeat gas across the holding window (the Sunday check is
 * free); the time is 30 minutes to set up, then the 10-minute weekly
 * action plus the 5-minute check, every week of the window.
 */
export function farmSummary(p: SnapshotProtocol, age: number | null): FarmSummary {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 250 ? 10 : capital >= 150 ? 6 : 4;
  const weeks = Math.ceil(hold / 7);
  return {
    capital_usd: capital,
    fees_usd: gas * 2 + 2 * weeks,
    setup_minutes: 30,
    weekly_minutes: 15,
    hold_days: hold,
  };
}

// ---------------------------------------------------------------- the board

/** The ranked board: every protocol that records no token, strongest implied value first. */
export function buildBoard(snapshot: Snapshot): { board: BoardRow[]; peers: PeerStats } {
  const peers = peerStats(snapshot);
  const watch = new Set(snapshot.watchlist);
  const scored = snapshot.protocols
    .filter(recordsNoToken)
    .map((p) => ({ p, v: impliedValue(p, snapshot.as_of, peers) }));
  scored.sort((a, b) => b.v.implied - a.v.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Strict, non-increasing values: a tie is nudged down $1 at a time so rank order is the value order.
  for (let i = 1; i < scored.length; i++) {
    if (scored[i]!.v.implied >= scored[i - 1]!.v.implied) scored[i]!.v.implied = Math.max(1, scored[i - 1]!.v.implied - 1);
  }
  const board = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'records-no-token' as const,
    watchlist: watch.has(s.p.slug),
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      category_ratio: s.v.ratio,
      ratio_source: s.v.source,
      category_peers: s.v.peers,
      momentum_multiplier: round4(s.v.momentum),
      maturity_multiplier: round4(s.v.maturity),
      breadth_multiplier: round4(s.v.breadth),
      plausibility_factor: s.v.plausibility_factor,
      plausibility_reason: s.v.plausibility_reason,
    },
    farm_steps: farmSteps(s.p, s.v.age),
    farm_summary: farmSummary(s.p, s.v.age),
  }));
  return { board, peers };
}

/** The live-token comparison set: the largest tokenized protocols by market cap, never ranked. */
export function liveRows(snapshot: Snapshot, limit = 24): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !recordsNoToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, limit)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

const MODEL_SUMMARY =
  'Implied value = TVL x the median market-cap/TVL multiple of the protocol\'s own category among tokenized peers in this snapshot ' +
  '(categories with fewer than 3 tokenized peers use the global median multiple), adjusted by 7-day TVL momentum ' +
  '(x0.83-x1.35), by maturity - how long the protocol has run while recording no token (x0.75-x1.25) - and by ' +
  'chain breadth (+3% per extra chain, up to +21%). One more step keeps the board honest: a protocol whose value ' +
  'already trades by proxy - a bridge or staking product of another token, an exchange, a versioned re-release, or a ' +
  'wrapped, staked or exchange-branded product, the same classes the watchlist rule leaves out - is not a launch ' +
  'waiting to happen, so its implied value is multiplied by a launch-plausibility factor of 0.04 and its row says ' +
  'why. It stays on the board; it just stops outranking genuine pre-token protocols. Every figure is computed ' +
  'from the snapshot at run time.';

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { board, peers } = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const rows: RadarRow[] = board.map((r) => ({
    rank: r.rank,
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    listed_at: r.listed_at,
    age_days: r.age_days,
    watchlist: r.watchlist,
    implied_value_usd: r.implied_value_usd,
    category_ratio: r.model.category_ratio,
    ratio_source: r.model.ratio_source,
    momentum_multiplier: r.model.momentum_multiplier,
    maturity_multiplier: r.model.maturity_multiplier,
    breadth_multiplier: r.model.breadth_multiplier,
    plausibility_factor: r.model.plausibility_factor,
    plausibility_reason: r.model.plausibility_reason,
    farm_steps: r.farm_steps,
    farm_summary: r.farm_summary,
  }));
  // The early radar: below the watchlist floor, ranked by 7-day momentum then TVL.
  const early = rows
    .filter((r) => r.tvl_usd < snapshot.floor_usd && r.change_7d !== null && r.change_7d > 0)
    .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 8);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model_summary: MODEL_SUMMARY,
    scanned: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !r.watchlist).length,
    live_size: live.length,
    total_implied_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    total_tvl_usd: board.reduce((n, r) => n + r.tvl_usd, 0),
    peers,
    rows,
    early,
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, values, farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'the board repeats a slug';
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `the board invents the slug ${r.slug}`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && byRank[0]!.implied_value_usd === byRank[byRank.length - 1]!.implied_value_usd) return 'every row shares one implied value';
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
