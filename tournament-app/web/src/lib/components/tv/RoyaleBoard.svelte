<script lang="ts">
  import { royaleView, type Battle, type PBRoyale } from "$lib/royale";
  import { faceCrop, type Face } from "$lib/fighters";
  import FighterSilhouette from "./FighterSilhouette.svelte";

  // The TV's battle royale scene: every battle as a white slab (heats along
  // the top, then the sudden death and the final), each fighter with their
  // picture and combat name. Winners get the gold, runners-up the silver;
  // battles still waiting on results show who'll fill them ("Heat 1 winner").
  // face: where the face is in the picture; the round picture zooms onto it.
  type Who = { name: string; kana: string; img: string; mirror?: boolean; face?: Face | null };
  let { royale, fighter }: { royale: PBRoyale; fighter: (name: string) => Who } = $props();

  const view = $derived(royaleView(royale));
  const heats = $derived(view?.battles.filter((b) => b.kind === "heat") ?? []);
  const later = $derived(view?.battles.filter((b) => b.kind !== "heat") ?? []);
  // Heats of 4 over a final of 5 fit at full size; bigger ones squeeze rows.
  const dense = $derived(!!view && Math.max(0, ...view.plan.heats) + view.plan.finalSize > 10);

  // Who'll be in a battle that's still waiting, in words.
  function placeholders(b: Battle): string[] {
    if (!view) return [];
    const n = heats.length;
    const heat = (i: number, what: string) => `Heat ${i + 1} ${what}`;
    if (b.kind === "sudden") return heats.map((_, i) => heat(i, "runner-up"));
    const winners = heats.map((_, i) => heat(i, "winner"));
    const rest = view.plan.finalSize - n;
    if (view.plan.sudden) return [...winners, ...Array.from({ length: view.plan.suddenPlaces }, () => "From the sudden death")];
    return [...winners, ...(rest > 0 ? heats.map((_, i) => heat(i, "runner-up")) : [])];
  }

  function mark(b: Battle, name: string): "win" | "second" | "through" | "out" | "" {
    if (b.status !== "done") return "";
    if (b.kind === "sudden") return b.result.advancing?.includes(name) ? "through" : "out";
    return b.result.winner === name ? "win" : b.result.runnerUp === name ? "second" : "out";
  }
  const MARK = { win: "Winner", second: "Runner-up", through: "Through", out: "", "": "" };
</script>

{#snippet card(b: Battle)}
  <section class="slab {b.kind} {b.status}">
    <header>
      <h3>{b.label}</h3>
      {#if b.status === "live"}<span class="chip live"><i></i>Live</span>
      {:else if b.status === "ready" && view?.next?.key === b.key}<span class="chip next">Up next</span>
      {:else if b.status === "waiting"}<span class="chip">Waiting</span>{/if}
      {#if b.kind === "sudden"}<span class="places">{b.places} through</span>{/if}
    </header>
    <ul>
      {#if b.entrants.length}
        {#each b.entrants as name (name)}
          {@const f = fighter(name)}
          {@const m = mark(b, name)}
          <li class={m}>
            <span class="pic">
              {#if f.img}<img src={f.img} alt="" style={faceCrop(f.face ?? null)} />{:else}<span class="sil"><FighterSilhouette /></span>{/if}
            </span>
            <span class="nm">
              <b>{f.name}</b>
              {#if f.name.toLowerCase() !== name.toLowerCase()}<small>{name}</small>{/if}
            </span>
            {#if MARK[m]}<span class="tag {m}">{MARK[m]}</span>{/if}
          </li>
        {/each}
      {:else}
        {#each placeholders(b) as p, i (i)}
          <li class="tbd"><span class="pic"></span><span class="nm"><b>{p}</b></span></li>
        {/each}
      {/if}
    </ul>
  </section>
{/snippet}

{#if view}
  <div class="board" class:dense style:--heats={heats.length}>
    {#if heats.length}
      <div class="heats">
        {#each heats as b (b.key)}{@render card(b)}{/each}
      </div>
    {/if}
    <div class="later">
      {#each later as b, i (b.key)}
        {#if i > 0 || heats.length}<span class="arrow" aria-hidden="true">▶</span>{/if}
        {@render card(b)}
      {/each}
    </div>
  </div>
{/if}

<style>
  .board {
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 28px;
  }
  .heats {
    display: grid;
    grid-template-columns: repeat(var(--heats), minmax(0, 1fr));
    gap: 24px;
    align-items: start;
  }
  .later {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 22px;
  }
  .later .slab {
    flex: 0 1 560px;
    min-width: 0;
  }
  .later .slab.final {
    flex-basis: 700px;
  }
  .arrow {
    font-size: 40px;
    color: var(--gold);
  }

  .slab {
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: 8px 8px 0 var(--ink);
  }
  .slab.live {
    box-shadow: 8px 8px 0 var(--red);
    border-color: var(--red);
  }
  .slab.final {
    box-shadow: 8px 8px 0 var(--gold);
  }
  .slab.waiting {
    opacity: 0.85;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--ink);
    color: var(--paper);
    padding: 8px 14px 10px;
  }
  .final header {
    background: var(--gold);
    color: var(--ink);
  }
  h3 {
    font-size: 2.1rem;
    flex: 1;
    padding-right: 0.1em;
  }
  .chip,
  .places {
    font-stretch: 75%;
    font-weight: 800;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 3px 10px;
    background: var(--field-line);
    color: var(--paper);
  }
  .chip.live {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--red);
  }
  .chip.live i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--paper);
    animation: pulse 1s ease-in-out infinite alternate;
  }
  .chip.next {
    background: var(--gold);
    color: var(--ink);
  }
  .places {
    background: transparent;
    color: var(--gold);
  }
  ul {
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 12px;
    border-top: 2px solid #e3e6f3;
    min-height: 62px;
  }
  li:first-child {
    border-top: 0;
  }
  .pic {
    position: relative;
    flex: none;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--field);
    border: 3px solid var(--ink);
  }
  .pic img {
    width: 100%;
    height: 100%;
    /* Without a face point; faceCrop() replaces this when there is one. */
    object-fit: cover;
    object-position: 60% 20%;
  }
  .sil {
    display: block;
    width: 100%;
    height: 100%;
    --lite: var(--on-field-soft);
  }
  .nm {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .nm b {
    font-family: var(--font-display);
    font-size: 1.5rem;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 0.15em; /* italic overhang */
  }
  .nm small {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .tbd .pic {
    background: #e3e6f3;
    border-style: dashed;
  }
  .tbd .nm b {
    font-family: var(--font-text);
    font-size: 1.1rem;
    font-weight: 700;
    text-transform: none;
    color: var(--ink-soft);
  }
  .tag {
    font-stretch: 75%;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.95rem;
    padding: 3px 10px;
    white-space: nowrap;
  }
  .tag.win {
    background: var(--gold);
    color: var(--ink);
    border: 2px solid var(--ink);
  }
  .tag.second {
    background: #d9dde9;
    color: var(--ink);
  }
  .tag.through {
    background: var(--green);
    color: var(--paper);
  }
  li.win {
    background: color-mix(in srgb, var(--gold) 28%, var(--paper));
  }
  li.out {
    opacity: 0.45;
  }
  .dense li {
    min-height: 44px;
    padding: 3px 10px;
  }
  .dense .pic {
    width: 36px;
    height: 36px;
    border-width: 2px;
  }
  .dense .nm b {
    font-size: 1.2rem;
  }
  .dense .nm small {
    display: none;
  }
  .dense h3 {
    font-size: 1.6rem;
  }
  @keyframes pulse {
    to {
      opacity: 0.3;
    }
  }
</style>
