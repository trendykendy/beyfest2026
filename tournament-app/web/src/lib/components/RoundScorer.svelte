<script lang="ts">
  import { enhance } from "$app/forms";
  import { FINISHES } from "$lib/finishes";
  import type { PBMatch } from "$lib/view";

  let {
    match,
    p1Name,
    p2Name,
    target,
  }: {
    match: PBMatch;
    p1Name: string;
    p2Name: string;
    target: number;
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
</script>

<div class="rs" class:over>
  <div class="rs-head">
    <span class="code">{match.code}</span>
    <span class="ft" class:hot={target > 5}>First to {target}</span>
    {#if rounds.length}<button type="button" class="undo" onclick={undo}>Undo</button>{/if}
  </div>

  <div class="rs-body">
    <div class="side" class:win={winner === 1}>
      <div class="pn">{p1Name}</div>
      <div class="score">{s1}</div>
      <div class="finishes">
        {#each FINISHES as f (f.key)}
          <button type="button" onclick={() => add(1, f.pts, f.label, f.key)} disabled={over} title={f.desc}>
            {f.label} <span class="pts">+{f.pts}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="mid"><span class="dash">–</span></div>

    <div class="side right" class:win={winner === 2}>
      <div class="pn">{p2Name}</div>
      <div class="score">{s2}</div>
      <div class="finishes">
        {#each FINISHES as f (f.key)}
          <button type="button" onclick={() => add(2, f.pts, f.label, f.key)} disabled={over} title={f.desc}>
            {f.label} <span class="pts">+{f.pts}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  {#if rounds.length}
    <div class="log">
      {#each rounds as r, i (i)}
        <span class="chip who{r.who}">{r.who === 1 ? p1Name : p2Name} · {r.label}</span>
      {/each}
    </div>
  {/if}

  {#if over}
    <form method="POST" action="?/score" use:enhance class="confirm">
      <input type="hidden" name="code" value={match.code} />
      <input type="hidden" name="s1" value={s1} />
      <input type="hidden" name="s2" value={s2} />
      <button class="btn primary record" type="submit">
        Record: {winner === 1 ? p1Name : p2Name} wins {s1}–{s2}
      </button>
    </form>
  {/if}
</div>

<style>
  .rs {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .rs.over {
    border-color: var(--green);
  }
  .rs-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .code {
    font-family: var(--font-text);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .ft {
    font-family: var(--font-text);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.66rem;
    color: var(--muted);
  }
  .ft.hot {
    color: var(--gold);
  }
  .undo {
    margin-left: auto;
    background: none;
    border: 1px solid var(--border-strong);
    color: var(--muted);
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .undo:hover {
    color: var(--text);
    border-color: var(--gold);
  }
  .rs-body {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: start;
    gap: 12px;
  }
  .side {
    text-align: center;
  }
  .pn {
    font-weight: 700;
    font-size: 1.05rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .side.win .pn {
    color: var(--green);
  }
  .score {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    font-size: 2.6rem;
    line-height: 1;
    margin: 2px 0 8px;
  }
  .side.win .score {
    color: var(--green);
  }
  .mid {
    align-self: center;
  }
  .dash {
    color: var(--muted);
    font-size: 1.4rem;
  }
  .finishes {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .finishes button {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
    background: var(--dark3);
    border: 1px solid var(--border-strong);
    color: var(--text);
    border-radius: 7px;
    padding: 7px 11px;
    font-family: var(--font-text);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
    font-size: 0.86rem;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
  }
  .finishes button:hover:not(:disabled) {
    border-color: var(--gold);
    color: var(--gold);
  }
  .finishes button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .pts {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .finishes button:hover:not(:disabled) .pts {
    color: var(--gold);
  }
  .log {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 10px;
  }
  .chip {
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 20px;
    background: var(--dark3);
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .confirm {
    margin-top: 10px;
  }
  .record {
    width: 100%;
  }
  @media (max-width: 560px) {
    .finishes button {
      font-size: 0.78rem;
      padding: 8px;
    }
  }
</style>
