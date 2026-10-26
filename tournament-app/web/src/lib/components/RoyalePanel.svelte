<script lang="ts">
  import { enhance } from "$app/forms";
  import { planInWords, planRoyale, royaleView, SPACES_MAX, SPACES_MIN, type Battle, type PBRoyale } from "$lib/royale";
  import { untrack } from "svelte";
  import Trophy from "./Trophy.svelte";

  // The admin's battle royale, after the main tournament: set it up (who's in,
  // how many fit around the arena), then run each battle: Start (the TV plays
  // its intro), then record the winner and runner-up, or for the sudden death
  // who goes through. A battle can be fixed until a later one is played.
  let { royale, players }: { royale: PBRoyale | null; players: string[] } = $props();

  // ── Setup ──
  // svelte-ignore state_referenced_locally
  let ticked = $state<string[]>([...players]);
  let extra = $state("");
  let spaces = $state(5);
  const extraNames = $derived(extra.split(/[\n,]/).map((n) => n.trim()).filter(Boolean));
  const count = $derived(ticked.length + extraNames.length);
  const plan = $derived(planRoyale(count, spaces));

  // ── Running ──
  const view = $derived(royale ? royaleView(royale) : null);
  // The battle on the card: one being fixed, else the next to play.
  let fixing = $state("");
  const card = $derived(view?.battles.find((b) => b.key === fixing && b.status === "done") ?? view?.next ?? null);

  // The card's picks, checked here before they're sent (the server checks
  // again): a winner, a runner-up who isn't the winner, or for the sudden
  // death exactly its number of places. Reset whenever the card changes.
  let winner = $state("");
  let runnerUp = $state("");
  let advancing = $state<string[]>([]);
  const cardId = $derived(card ? `${card.key}|${card.status}|${card.entrants.join()}` : "");
  $effect(() => {
    cardId;
    untrack(() => {
      winner = card?.result.winner ?? "";
      runnerUp = card?.result.runnerUp ?? "";
      advancing = [...(card?.result.advancing ?? [])];
    });
  });
  // What's still missing, or "" when the result can be recorded.
  const problem = $derived.by(() => {
    if (!card) return "";
    if (card.kind === "sudden") {
      const left = card.places - advancing.length;
      return left > 0 ? `Tick ${left} more.` : "";
    }
    if (!winner) return "Pick the winner.";
    if (card.entrants.length > 1 && !runnerUp) return "Pick the runner-up.";
    return "";
  });
  // A new winner who was the runner-up: the runner-up needs picking again.
  function pickWinner(n: string) {
    if (runnerUp === n) runnerUp = "";
  }

  const STATUS: Record<Battle["status"], string> = { waiting: "Waiting", ready: "Ready", live: "Playing", done: "Done" };
  const afterSave = () => {
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      fixing = "";
    };
  };
</script>

<section class="royale">
  <h2 class="kicker">Battle royale</h2>

  {#if !royale}
    <form method="POST" action="?/royaleCreate" use:enhance class="setup">
      <p class="hint">Everyone at once, last bey spinning wins. Untick anyone who's gone home, add anyone who wants in.</p>
      <div class="ticks">
        {#each players as p (p)}
          <label class="tick"><input type="checkbox" name="names" value={p} bind:group={ticked} /> {p}</label>
        {/each}
      </div>
      <label class="field">
        <span>Add names (one per line)</span>
        <textarea name="extra" rows="2" bind:value={extra} placeholder="Walk-in blader"></textarea>
      </label>
      <label class="field spaces">
        <span>Spaces around the arena</span>
        <input type="number" name="spaces" min={SPACES_MIN} max={SPACES_MAX} bind:value={spaces} />
      </label>
      <p class="preview" class:bad={"error" in plan}>
        <b>{count} bladers.</b>
        {"error" in plan ? plan.error : planInWords(plan)}
      </p>
      <button class="big-action" type="submit" disabled={"error" in plan}>Draw heats and start</button>
    </form>
  {:else if view}
    <ol class="battles">
      {#each view.battles as b (b.key)}
        <li class="b {b.status}" class:on={card?.key === b.key}>
          <span class="b-label">{b.label}</span>
          <span class="b-who">
            {#if b.status === "done"}
              {b.kind === "sudden" ? `Through: ${b.result.advancing?.join(", ")}` : `${b.result.winner} wins`}
            {:else if b.entrants.length}{b.entrants.join(", ")}
            {:else}Waiting on earlier battles{/if}
          </span>
          <span class="b-status">{STATUS[b.status]}</span>
          {#if b.status === "done" && fixing !== b.key}
            <button class="link" type="button" onclick={() => (fixing = b.key)}>Fix</button>
          {/if}
        </li>
      {/each}
    </ol>

    {#if view.champion && !fixing}
      <div class="champ"><Trophy /> <span><small>Battle royale champion</small>{view.champion}</span></div>
    {:else if card}
      {#key `${card.key}|${card.status}|${card.entrants.join()}`}
        <div class="card">
          <header>
            <h3>{card.label}{fixing ? " (fixing)" : ""}</h3>
            {#if card.status !== "done"}
              <form method="POST" action="?/royaleStart" use:enhance>
                <input type="hidden" name="id" value={royale.id} />
                <input type="hidden" name="key" value={card.key} />
                <input type="hidden" name="start" value={card.status === "live" ? "false" : "true"} />
                <button class="btn" class:start={card.status !== "live"}>
                  {card.status === "live" ? "Cancel start" : "Start battle"}
                </button>
              </form>
            {/if}
          </header>

          <form method="POST" action="?/royaleResult" use:enhance={afterSave} class="result">
            <input type="hidden" name="id" value={royale.id} />
            <input type="hidden" name="key" value={card.key} />
            {#if card.kind === "sudden"}
              <p class="ask">Tick the {card.places} still spinning at the end: they go through to the final.</p>
              <div class="chips">
                {#each card.entrants as n (n)}
                  <!-- Once the places are filled, the rest can't be ticked. -->
                  <label class="chip">
                    <input
                      type="checkbox"
                      name="advancing"
                      value={n}
                      bind:group={advancing}
                      disabled={!advancing.includes(n) && advancing.length >= card.places}
                    />
                    <span>{n}</span>
                  </label>
                {/each}
              </div>
            {:else}
              <p class="ask">Winner (last bey spinning)</p>
              <div class="chips">
                {#each card.entrants as n (n)}
                  <label class="chip gold">
                    <input type="radio" name="winner" value={n} bind:group={winner} onchange={() => pickWinner(n)} required />
                    <span>{n}</span>
                  </label>
                {/each}
              </div>
              {#if card.entrants.length > 1}
                <p class="ask">Runner-up (the last one out before them)</p>
                <div class="chips">
                  {#each card.entrants as n (n)}
                    <!-- The winner can't be the runner-up too. -->
                    <label class="chip">
                      <input type="radio" name="runnerUp" value={n} bind:group={runnerUp} disabled={n === winner} required />
                      <span>{n}</span>
                    </label>
                  {/each}
                </div>
              {/if}
            {/if}
            {#if problem}<p class="missing">{problem}</p>{/if}
            <div class="row">
              <button class="big-action" type="submit" disabled={!!problem}>{fixing ? "Save the fix" : "Record result"}</button>
              {#if fixing}<button class="btn" type="button" onclick={() => (fixing = "")}>Cancel</button>{/if}
            </div>
          </form>
        </div>
      {/key}
    {/if}

    <form
      method="POST"
      action="?/royaleReset"
      use:enhance
      onsubmit={(e) => {
        if (!confirm("Delete the battle royale and every result in it?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={royale.id} />
      <button class="link danger" type="submit">Reset battle royale</button>
    </form>
  {/if}
</section>

<style>
  .royale {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 28px;
  }
  /* The admin page's heading and big gold button (scoped there). */
  .kicker {
    font-size: 1.5rem;
  }
  .big-action {
    width: 100%;
    min-height: 64px;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.8rem;
    background: var(--gold);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);
    cursor: pointer;
  }
  .big-action:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }
  /* On the admin page's dark field, like the rest of it. */
  .hint,
  .ask {
    color: var(--muted);
    font-size: 0.95rem;
  }
  .ask {
    font-weight: 700;
    color: var(--text);
  }
  .setup,
  .result {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ticks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 6px;
  }
  .tick {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 2px solid var(--border-strong);
    font-weight: 600;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 700;
    font-size: 0.9rem;
  }
  .spaces input {
    width: 6em;
  }
  .preview {
    font-weight: 600;
  }
  .preview.bad {
    color: var(--red);
  }
  .battles {
    list-style: none;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 2px solid var(--border-strong);
  }
  .b {
    display: grid;
    grid-template-columns: 8em 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-top: 2px solid var(--border);
  }
  .b:first-child {
    border-top: 0;
  }
  .b.on {
    background: color-mix(in srgb, var(--gold) 18%, transparent);
  }
  .b-label {
    font-family: var(--font-display);
    text-transform: uppercase;
  }
  .b-who {
    min-width: 0;
    color: var(--muted);
  }
  .b.done .b-who {
    color: var(--text);
    font-weight: 700;
  }
  .b-status {
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 8px;
    background: var(--dark3);
    color: var(--muted);
  }
  .b.live .b-status {
    background: var(--red);
    color: var(--paper);
  }
  .b.done .b-status {
    background: var(--paper);
    color: var(--ink);
  }
  .card {
    background: var(--surface);
    border: 3px solid var(--gold);
    box-shadow: 5px 5px 0 var(--ink);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .card h3 {
    font-size: 1.6rem;
  }
  .btn.start {
    background: var(--red);
    color: var(--paper);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .chip span {
    display: inline-block;
    padding: 10px 14px;
    min-width: 6em;
    text-align: center;
    border: 2px solid var(--border-strong);
    font-weight: 700;
    cursor: pointer;
  }
  .chip input:checked + span {
    background: var(--paper);
    color: var(--ink);
    border-color: var(--paper);
  }
  .chip.gold input:checked + span {
    background: var(--gold);
    color: var(--ink);
  }
  .chip input:disabled + span {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .missing {
    color: var(--gold);
    font-weight: 700;
  }
  .chip input:focus-visible + span {
    outline: 3px solid var(--wb);
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .champ {
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: var(--font-display);
    font-size: 2rem;
    text-transform: uppercase;
  }
  .champ small {
    display: block;
    font-size: 0.45em;
    letter-spacing: 0.1em;
    color: var(--gold);
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    color: var(--text);
  }
  .link.danger {
    color: var(--red);
  }
</style>
