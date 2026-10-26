<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { books, leaderboard, type Bettor, type PBBet, type PBBettor, type SettledBet } from "$lib/betting";
  import { bettingOpen, matchOdds } from "$lib/odds";
  import { isLive, liveMatches, matchContext, tierOf, upNext, type PBMatch } from "$lib/view";
  import BetJoin from "./BetJoin.svelte";

  // Play-money betting: your balance, the matches you can bet on (with odds
  // from form and the live score), your bets and the leaderboard. The server
  // (/live/bet) checks every bet; this only shows and asks.
  let {
    matches,
    names,
    bettors,
    bets,
    me,
    enabled,
    nextCode = "",
    onjoin,
    onlost,
  }: {
    matches: PBMatch[];
    names: Map<string, string>;
    bettors: PBBettor[];
    bets: PBBet[];
    me: Bettor | null;
    enabled: boolean; // false when the server has no betting login
    nextCode?: string;
    onjoin: (b: Bettor) => void;
    onlost: () => void; // this phone's bettor is gone (tournament reset)
  } = $props();

  const money = (n: number) => `$${n.toLocaleString("en-IE")}`;
  const oddsText = (o: number) => `×${o.toFixed(2)}`;

  const all = $derived(books(bettors, bets, matches));
  const mine = $derived(me ? all.find((b) => b.bettor.id === me.id) : undefined);
  const board = $derived(leaderboard(all));
  const myRow = $derived(board.find((r) => r.bettor.id === me?.id));
  // Live first, then the TV's call order. A live match on match point stays
  // in the list, marked closed, until its result is in (then it drops out).
  const open = $derived([...liveMatches(matches), ...upNext(matches, nextCode)].slice(0, 6));
  const byId = $derived(new Map(matches.map((m) => [m.id, m])));

  // ── The bet slip: one open at a time ────────────────────────────────
  let slip = $state<{ match: string; pick: string; stake: number; odds: number | null } | null>(null);
  let busy = $state(false);
  let say = $state<{ text: string; good: boolean } | null>(null);

  // Betting closed on the slip's match (match point, or the result went in
  // while it was open): put the slip away.
  $effect(() => {
    if (!slip) return;
    const m = byId.get(slip.match);
    if (!m || !bettingOpen(m)) slip = null;
  });

  function choose(m: PBMatch, pick: string) {
    say = null;
    slip = slip?.match === m.id && slip.pick === pick ? null : { match: m.id, pick, stake: 0, odds: null };
  }
  function add(n: number) {
    if (!slip || !mine) return;
    slip.stake = Math.min(mine.balance, slip.stake + n);
  }

  // The odds the slip will bet at: the shown ones, or the new ones the server
  // offered after they moved.
  function slipOdds(m: PBMatch): number {
    if (slip?.odds) return slip.odds;
    const o = matchOdds(m, matches);
    return slip?.pick === m.p1 ? o.p1 : o.p2;
  }

  async function place(m: PBMatch) {
    if (!slip || !me || slip.stake < 1) return;
    busy = true;
    say = null;
    const odds = slipOdds(m);
    try {
      const res = await fetch("/live/bet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "bet", id: me.id, token: me.token, match: m.id, pick: slip.pick, stake: slip.stake, odds }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        say = { text: `Bet placed: ${money(slip.stake)} on ${names.get(slip.pick)}.`, good: true };
        slip = null;
        await invalidateAll();
      } else if (res.status === 409 && typeof body.odds === "number") {
        slip.odds = body.odds;
        say = { text: `The odds just moved to ${oddsText(body.odds)}. Tap Bet again to take them.`, good: false };
      } else if (res.status === 410) {
        onlost();
      } else {
        say = { text: body.message ?? "That didn't work. Try again.", good: false };
      }
    } catch {
      say = { text: "No connection. Try again.", good: false };
    } finally {
      busy = false;
    }
  }

  function betLine(b: SettledBet): string {
    const m = byId.get(b.match);
    const other = m ? names.get(b.pick === m.p1 ? m.p2 : m.p1) : "";
    return `${names.get(b.pick) ?? "?"}${other ? ` v ${other}` : ""}`;
  }
</script>

{#if !enabled}
  <section>
    <h2 class="lv-h">Betting</h2>
    <p class="lv-note">Betting is closed right now.</p>
  </section>
{:else if !me || !mine}
  <BetJoin {onjoin} />
{:else}
  <section class="wallet" aria-label="Your money">
    <div>
      <span class="w-tag">{me.name}{#if myRow}<span class="rank">#{myRow.rank} of {board.length}</span>{/if}</span>
      <span class="w-cash">{money(mine.balance)}</span>
    </div>
    {#if mine.atStake}<span class="w-riding">{money(mine.atStake)} riding</span>{/if}
  </section>

  {#if say}<p class="say" class:good={say.good} role="status">{say.text}</p>{/if}

  <section>
    <h2 class="lv-h">Bet now</h2>
    {#each open as m (m.id)}
      {@const o = matchOdds(m, matches)}
      {@const live = isLive(m)}
      {@const closed = !bettingOpen(m)}
      <div class="lv-slab card tier-{tierOf(m.stage)}" class:closed>
        <div class="cap">
          <span>{matchContext(m, matches)}</span>
          {#if live}<span class="live"><span class="lv-dot"></span>{m.liveP1}–{m.liveP2}</span>{/if}
        </div>
        <div class="sides">
          {#each [{ id: m.p1, odds: o.p1 }, { id: m.p2, odds: o.p2 }] as s (s.id)}
            {@const on = slip?.match === m.id && slip.pick === s.id}
            <button class="side" class:on aria-pressed={on} disabled={closed} onclick={() => choose(m, s.id)}>
              <span class="nm">{names.get(s.id)}</span>
              {#if !closed}<span class="od">{oddsText(s.odds)}</span>{/if}
            </button>
          {/each}
        </div>
        {#if closed}
          <p class="shut" role="status">Betting closed · waiting for the result</p>
        {/if}
        {#if slip?.match === m.id && !closed}
          {@const odds = slipOdds(m)}
          <div class="slip">
            <div class="chips">
              <button onclick={() => add(100)}>+$100</button>
              <button onclick={() => add(500)}>+$500</button>
              <button onclick={() => add(1000)}>+$1k</button>
              <button onclick={() => slip && mine && (slip.stake = mine.balance)}>All in</button>
            </div>
            <div class="stake">
              <span>Stake <b>{money(slip.stake)}</b></span>
              {#if slip.stake}<button class="clear" onclick={() => slip && (slip.stake = 0)}>Clear</button>{/if}
            </div>
            <button class="go" disabled={busy || slip.stake < 1} onclick={() => place(m)}>
              {#if slip.stake < 1}Pick a stake
              {:else}Bet {money(slip.stake)} · win {money(Math.round(slip.stake * odds))}{/if}
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <p class="lv-note">No matches taking bets right now. Bets open once both bladers are known and close on match point.</p>
    {/each}
  </section>

  {#if mine.bets.length}
    <section>
      <h2 class="lv-h">Your bets</h2>
      <div class="lv-slab">
        {#each mine.bets as b (b.id)}
          <div class="bet {b.state}">
            <span class="b-what">
              <span class="b-who">{betLine(b)}</span>
              <span class="b-sub">{money(b.stake)} at {oddsText(b.odds)}</span>
            </span>
            <span class="b-state">
              {#if b.state === "open"}Win {money(Math.round(b.stake * b.odds))}
              {:else if b.state === "won"}+{money(b.returns - b.stake)}
              {:else if b.state === "lost"}Lost
              {:else}Refunded{/if}
            </span>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section>
    <h2 class="lv-h">Leaderboard</h2>
    <div class="lv-slab">
      {#each board.slice(0, 10) as r (r.bettor.id)}
        <div class="lb" class:me={r.bettor.id === me.id}>
          <span class="lb-rank">{r.rank}</span><span class="lb-name">{r.bettor.name}</span><span>{money(r.worth)}</span>
        </div>
      {/each}
      {#if myRow && myRow.rank > 10}
        <div class="lb me">
          <span class="lb-rank">{myRow.rank}</span><span class="lb-name">{me.name}</span><span>{money(myRow.worth)}</span>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  /* ── Wallet: the black-and-gold slab, like the champion card ─────── */
  .wallet {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    background: var(--ink);
    color: var(--paper);
    border: var(--outline) solid var(--gold);
    box-shadow: 5px 5px 0 var(--gold);
    padding: 12px 16px;
  }
  .wallet div {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .w-tag,
  .w-riding {
    font-stretch: 75%;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.85rem;
    color: var(--gold);
  }
  .rank {
    color: var(--on-field-soft);
    margin-left: 8px;
  }
  .w-cash {
    font-family: var(--font-display);
    font-size: 2.6rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .w-riding {
    color: var(--paper);
    white-space: nowrap;
  }
  .say {
    background: var(--gold);
    color: var(--ink);
    font-weight: 700;
    padding: 10px 12px;
    border: 2px solid var(--ink);
  }
  .say.good {
    background: var(--paper);
  }

  /* ── A match to bet on ──────────────────────────────────────────── */
  .card {
    --tier: var(--field-line);
    border-left-width: 8px;
    border-left-color: var(--tier);
  }
  .card + .card {
    margin-top: 14px;
  }
  .tier-wb {
    --tier: var(--wb);
  }
  .tier-mb {
    --tier: var(--mb);
  }
  .tier-lb {
    --tier: var(--lb);
  }
  .tier-gf {
    --tier: var(--gold);
  }
  .cap {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 8px 12px 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--red);
  }
  .sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 8px 12px 12px;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-height: 64px;
    padding: 6px;
    background: var(--paper);
    color: var(--ink);
    border: 2px solid var(--ink);
    cursor: pointer;
    min-width: 0;
  }
  .side.on {
    background: var(--ink);
    color: var(--paper);
    box-shadow: 3px 3px 0 var(--gold);
  }
  .nm {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 1.2rem;
    line-height: 1.1;
    text-transform: uppercase;
    max-width: 100%;
    overflow: hidden;
    padding-right: 0.15em; /* italic overhang: the clip would cut the last letter */
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .od {
    font-family: var(--font-display);
    font-size: 1.4rem;
    line-height: 1;
    color: var(--red);
    font-variant-numeric: tabular-nums;
  }
  .side.on .od {
    color: var(--gold);
  }
  /* On match point: the bladers stay up, greyed, until the result is in. */
  .side:disabled {
    cursor: default;
    color: #8a90ad;
    border-color: #c5c9dc;
    min-height: 48px;
  }
  .shut {
    margin: 0 12px 12px;
    padding: 8px 10px;
    text-align: center;
    font-stretch: 75%;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.85rem;
    background: var(--ink);
    color: var(--gold);
  }

  /* ── The slip ───────────────────────────────────────────────────── */
  .slip {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 12px 12px;
  }
  .chips {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .chips button,
  .clear {
    min-height: 44px;
    font-stretch: 75%;
    font-weight: 800;
    font-size: 0.95rem;
    background: var(--field-deep);
    color: var(--paper);
    border: 2px solid var(--ink);
    cursor: pointer;
  }
  .stake {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 1.05rem;
  }
  .clear {
    min-height: 36px;
    padding: 0 12px;
    background: transparent;
    color: var(--ink);
  }
  .go {
    min-height: 52px;
    font-family: var(--font-display);
    font-size: 1.25rem;
    text-transform: uppercase;
    background: var(--gold);
    color: var(--ink);
    border: 2px solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    cursor: pointer;
  }
  .go:disabled {
    opacity: 0.55;
  }

  /* ── Your bets / leaderboard rows ───────────────────────────────── */
  .bet,
  .lb {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 6px 12px;
    border-top: 2px solid #e3e6f3;
  }
  .bet:first-child,
  .lb:first-child {
    border-top: 0;
  }
  .b-what {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .b-who {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 1.15rem;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    padding-right: 0.15em; /* italic overhang: the clip would cut the last letter */
    text-overflow: ellipsis;
  }
  .b-sub {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .b-state {
    font-family: var(--font-display);
    font-size: 1.05rem;
    padding: 5px 8px 6px;
    white-space: nowrap;
    background: #e3e6f3;
  }
  .won .b-state {
    background: var(--gold);
  }
  .lost {
    color: #8a90ad;
  }
  .open .b-state {
    background: var(--ink);
    color: var(--paper);
  }
  .lb {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-variant-numeric: tabular-nums;
  }
  .lb-rank {
    width: 2ch;
    text-align: right;
    color: var(--ink-soft);
  }
  .lb-name {
    flex: 1;
    min-width: 0;
    font-stretch: 62%;
    text-transform: uppercase;
    overflow: hidden;
    padding-right: 0.15em; /* italic overhang: the clip would cut the last letter */
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lb.me {
    background: color-mix(in srgb, var(--gold) 26%, var(--paper));
  }
</style>
