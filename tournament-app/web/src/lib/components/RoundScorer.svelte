<script lang="ts">
  import { enhance } from "$app/forms";
  import { FINISHES } from "$lib/finishes";
  import type { PBMatch } from "$lib/view";
  import Trophy from "./Trophy.svelte";

  let {
    match,
    p1Name,
    p2Name,
    target,
    context,
    tier,
  }: {
    match: PBMatch;
    p1Name: string;
    p2Name: string;
    target: number;
    context: string; // "Group 3, match 2 of 6" / "Mid bracket round 2"
    tier: string; // colours the card tops like the TV: group | wb | mb | lb | gf
  } = $props();

  // Round log — each entry is one round win. Score is derived from it, so
  // Undo is just a pop. It starts from the log saved on the match, so
  // reloading the page mid-match picks up where it left off instead of 0–0.
  type Round = { who: 1 | 2; pts: number; label: string; key: string };
  const FINISH_BY_KEY = new Map(FINISHES.map((f) => [f.key, f]));
  function savedRounds(): Round[] {
    const out: Round[] = [];
    for (const r of match.liveLog) {
      const f = FINISH_BY_KEY.get(r.finish);
      if (f && (r.who === 1 || r.who === 2)) out.push({ who: r.who, pts: f.pts, label: f.label, key: f.key });
    }
    return out;
  }
  const initial = savedRounds();
  let rounds = $state<Round[]>(initial);

  const s1 = $derived(rounds.filter((r) => r.who === 1).reduce((a, r) => a + r.pts, 0));
  const s2 = $derived(rounds.filter((r) => r.who === 2).reduce((a, r) => a + r.pts, 0));
  const winner = $derived(s1 >= target ? 1 : s2 >= target ? 2 : 0);
  const over = $derived(winner !== 0);

  function add(who: 1 | 2, pts: number, label: string, key: string) {
    if (over) return;
    rounds = [...rounds, { who, pts, label, key }];
  }
  function undo() {
    rounds = rounds.slice(0, -1);
  }

  // Push the running score to the server so the public/TV displays show it live.
  // Skips the initial state on mount (it's already on the server); de-dupes
  // repeat values.
  const total = (who: 1 | 2) => initial.filter((r) => r.who === who).reduce((a, r) => a + r.pts, 0);
  let everScored = initial.length > 0;
  let posted = `${total(1)}-${total(2)}-${initial.length}`;
  $effect(() => {
    const key = `${s1}-${s2}-${rounds.length}`;
    if (rounds.length === 0 && !everScored) return;
    everScored = true;
    if (key === posted) return;
    posted = key;
    fetch("/admin/live", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: match.code, s1, s2, log: rounds.map((r) => ({ who: r.who, finish: r.key })) }),
    }).catch(() => {});
  });

  const last = $derived(rounds[rounds.length - 1]);

  // "Start match": the launch. Makes the match live on the TV straight away and
  // cues its 3·2·1 countdown. Only offered before the first round.
  let askingWalkover = $state(false); // "who didn't show?" is open
  const wasStarted = () => !!match.startedAt; // read once, like the saved rounds
  let started = $state(wasStarted());
  async function setStarted(start: boolean) {
    started = start;
    await fetch("/admin/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: match.code, start }),
    }).catch(() => {});
  }
  const nameOf = (who: 1 | 2) => (who === 1 ? p1Name : p2Name);
  const SIDES = [1, 2] as const;
</script>

<!-- The organiser's scorer, built like the TV's Match centre so what you tap
     here looks like what the room sees: two player cards, a finish button per
     way to win a round, and each round won kept as a pill. -->
<div class="rs tier-{tier}" class:over>
  <div class="rs-status">
    {#if over}<span class="tag won"><Trophy /> Match won</span>
    {:else if rounds.length || started}<span class="tag live">Live</span>
    {:else}<span class="tag ready">Ready</span>{/if}
    <span class="context">{context}</span>
    <span class="ft">First to {target}</span>
  </div>

  {#if !started && rounds.length === 0}
    <button type="button" class="start" onclick={() => setStarted(true)}>
      Start match <span>Let it rip on the TV</span>
    </button>
  {/if}

  <div class="rs-duel">
    {#each SIDES as who (who)}
      {@const score = who === 1 ? s1 : s2}
      <div class="side" class:win={winner === who} class:lose={over && winner !== who}>
        <div class="card">
          <span class="pn">{nameOf(who)}</span>
          <span class="score">{score}</span>
        </div>
        <!-- Once the match is won the buttons make way, so Record sits right
             under the cards instead of below the fold. -->
        {#if !over}
          <div class="finishes">
            {#each FINISHES as f (f.key)}
              <button type="button" class="fin" onclick={() => add(who, f.pts, f.label, f.key)} title={f.desc}>
                <span class="fin-label"><b>{f.label}</b></span><span class="fin-pts"><b>+{f.pts}</b></span>
              </button>
            {/each}
          </div>
        {/if}
        <div class="pills" aria-label="Rounds won by {nameOf(who)}">
          {#each rounds as r, i (i)}
            {#if r.who === who}
              <span class="pill" class:newest={i === rounds.length - 1}>
                <span class="fin-label"><b>{r.label}</b></span><span class="fin-pts"><b>+{r.pts}</b></span>
              </span>
            {/if}
          {/each}
        </div>
      </div>
      {#if who === 1}<div class="vs" aria-hidden="true">VS</div>{/if}
    {/each}
  </div>

  <div class="rs-foot">
    {#if over}
      <form method="POST" action="?/score" use:enhance class="confirm">
        <input type="hidden" name="code" value={match.code} />
        <input type="hidden" name="s1" value={s1} />
        <input type="hidden" name="s2" value={s2} />
        <button class="record" type="submit">
          Record result: {nameOf(winner as 1 | 2)} wins {Math.max(s1, s2)}–{Math.min(s1, s2)}
        </button>
      </form>
    {/if}
    {#if started && rounds.length === 0}
      <button type="button" class="undo" onclick={() => setStarted(false)}>Cancel start</button>
    {/if}
    {#if !over}
      {#if askingWalkover}
        <!-- Who didn't show? The other blader wins at the target, 0 against. -->
        <form method="POST" action="?/walkover" use:enhance class="wo">
          <input type="hidden" name="code" value={match.code} />
          <span class="wo-q">Walkover: who didn't show?</span>
          <button class="wo-pick" name="noShow" value="1">{p1Name}</button>
          <button class="wo-pick" name="noShow" value="2">{p2Name}</button>
          <button type="button" class="undo" onclick={() => (askingWalkover = false)}>Cancel</button>
        </form>
      {:else}
        <button type="button" class="undo" onclick={() => (askingWalkover = true)}>Walkover…</button>
      {/if}
    {/if}
    {#if last}
      <button type="button" class="undo" onclick={undo}>
        Undo {last.label} +{last.pts} for {nameOf(last.who)}
      </button>
    {/if}
  </div>
</div>

<style>
  .rs {
    --tier: var(--gold);
  }
  .tier-wb {
    --tier: var(--wb);
  }
  .tier-lb {
    --tier: var(--lb);
  }

  /* Status line: a tag slab, then where the match sits and its target. */
  .rs-status {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 18px;
    font-weight: 600;
    font-size: 1.15rem;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.3rem;
    line-height: 1;
    padding: 6px 16px 8px;
    clip-path: polygon(var(--cut) 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%);
  }
  .tag.ready {
    background: var(--ink);
    color: var(--paper);
  }
  .tag.live {
    background: var(--red);
    color: var(--paper);
  }
  .tag.won {
    background: var(--gold);
    color: var(--ink);
  }
  .ft {
    color: var(--on-field-soft);
  }

  .rs-duel {
    display: grid;
    grid-template-columns: 1fr 70px 1fr;
    align-items: start;
  }
  .vs {
    align-self: start;
    margin-top: 44px;
    text-align: center;
    font-family: var(--font-display);
    font-size: 3.2rem;
    line-height: 1;
    color: var(--gold);
    -webkit-text-stroke: 2px var(--ink);
    paint-order: stroke fill;
  }
  .side {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Player card: the TV's white slab, tier colour along the top. */
  .card {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    border-top: 10px solid var(--tier);
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);
    padding: 10px 18px 6px;
    min-width: 0;
  }
  .pn {
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 2.6rem;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 0.1em; /* italic overhang */
  }
  .score {
    font-family: var(--font-display);
    font-size: 5.5rem;
    line-height: 0.85;
    font-variant-numeric: tabular-nums;
  }
  .side.win .card {
    background: var(--gold);
  }
  .side.lose .card {
    background: #dfe3f2;
    color: var(--ink-soft);
  }

  /* Finish buttons: the same gold + red build as the TV's finish pills, so a
     tap here reads exactly like the call-out it triggers. */
  .finishes {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .fin,
  .pill {
    display: flex;
    align-items: stretch;
    border: var(--outline) solid var(--ink);
    font-family: var(--font-display);
    text-transform: uppercase;
    line-height: 1;
    white-space: nowrap;
    color: var(--ink);
  }
  .fin {
    width: 100%;
    min-height: 60px;
    font-size: 1.7rem;
    background: var(--paper);
    box-shadow: 4px 4px 0 var(--ink);
    cursor: pointer;
    padding: 0;
    transition: transform 0.05s, box-shadow 0.05s;
  }
  .fin-label,
  .fin-pts {
    display: grid;
    place-items: center;
  }
  .fin-label {
    flex: 1;
    justify-content: start;
    padding: 0 18px;
  }
  .fin-pts {
    background: var(--red);
    color: var(--paper);
    border-left: var(--outline) solid var(--ink);
    padding: 0 16px;
    min-width: 2.2em; /* same width for +1 / +2 / +3 so the column lines up */
  }
  .fin b,
  .pill b {
    font-weight: inherit;
  }
  .fin:hover {
    background: var(--gold);
  }
  /* Pressed: the slab sinks onto its shadow. */
  .fin:active {
    transform: translate(3px, 3px);
    box-shadow: 1px 1px 0 var(--ink);
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 34px;
  }
  .pill {
    font-size: 1.1rem;
    background: var(--gold);
    box-shadow: 3px 3px 0 var(--ink);
  }
  .pill .fin-label {
    padding: 4px 8px;
  }
  .pill .fin-pts {
    padding: 4px 7px;
  }
  /* The round Undo would take back. */
  .pill.newest {
    outline: 3px solid var(--paper);
    outline-offset: 2px;
  }

  .rs-foot {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    margin-top: 18px;
  }
  .undo {
    align-self: flex-start;
    background: none;
    border: 2px solid var(--border-strong);
    color: var(--on-field-soft);
    font-family: var(--font-text);
    font-weight: 600;
    font-size: 1rem;
    padding: 8px 16px;
    cursor: pointer;
  }
  .undo:hover {
    color: var(--paper);
    border-color: var(--paper);
  }
  .record {
    width: 100%;
    min-height: 72px;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 2rem;
    line-height: 1;
    background: var(--green);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);
    cursor: pointer;
  }
  .record:active {
    transform: translate(3px, 3px);
    box-shadow: 2px 2px 0 var(--ink);
  }
  /* The launch button: red slab, full width, above the cards. */
  .start {
    width: 100%;
    min-height: 64px;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 2rem;
    line-height: 1;
    background: var(--red);
    color: var(--paper);
    border: var(--outline) solid var(--ink);
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);
    cursor: pointer;
  }
  .start span {
    font-family: var(--font-text);
    text-transform: none;
    font-size: 1rem;
    font-weight: 600;
  }
  .start:active {
    transform: translate(3px, 3px);
    box-shadow: 2px 2px 0 var(--ink);
  }
  .wo {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px 12px;
    border: 2px dashed var(--red);
  }
  .wo-q {
    font-weight: 700;
    margin-right: 6px;
  }
  .wo-pick {
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 1.4rem;
    line-height: 1;
    padding: 8px 16px 10px;
    background: var(--paper);
    color: var(--ink);
    border: 2px solid var(--ink);
    cursor: pointer;
  }
  .wo-pick:hover {
    background: var(--red);
    color: var(--paper);
  }
</style>
