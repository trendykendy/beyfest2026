<script lang="ts">
  import Trophy from "$lib/components/Trophy.svelte";
  import { royaleView, type Battle, type PBRoyale } from "$lib/royale";

  // The battle royale on the phone's Now tab: each battle with who's in it,
  // the one being played marked live, winners and runners-up once they're in,
  // and the champion at the top when it's over. The followed blader (matched
  // by name, since battle royale entrants needn't be tournament players) is
  // underlined, like everywhere else.
  let { royale, followName = "" }: { royale: PBRoyale; followName?: string } = $props();

  const view = $derived(royaleView(royale));
  const isMe = (n: string) => !!followName && n.trim().toLowerCase() === followName.trim().toLowerCase();

  function mark(b: Battle, n: string): string {
    if (b.status !== "done") return "";
    if (b.kind === "sudden") return b.result.advancing?.includes(n) ? "through" : "out";
    return b.result.winner === n ? "win" : b.result.runnerUp === n ? "second" : "out";
  }
  const TAG: Record<string, string> = { win: "Winner", second: "2nd", through: "Through" };
</script>

{#if view}
  <section>
    <h2 class="lv-h">Battle royale</h2>
    {#if view.champion}
      <div class="champ">
        <Trophy size="56px" />
        <div><span class="champ-tag">Battle royale champion</span><span class="champ-name">{view.champion}</span></div>
      </div>
    {/if}
    <div class="lv-slab">
      {#each view.battles as b (b.key)}
        <div class="battle {b.status} {b.kind}">
          <div class="b-head">
            <span class="b-label">{b.label}</span>
            {#if b.status === "live"}<span class="chip live"><span class="lv-dot"></span>Live</span>
            {:else if b.status === "ready" && view.next?.key === b.key}<span class="chip next">Next</span>{/if}
            {#if b.kind === "sudden"}<span class="places">{b.places} go through</span>{/if}
          </div>
          {#if b.entrants.length}
            <ul>
              {#each b.entrants as n (n)}
                {@const m = mark(b, n)}
                <li class={m} class:me={isMe(n)}>
                  <span class="nm">{n}</span>
                  {#if TAG[m]}<span class="tag {m}">{TAG[m]}</span>{/if}
                </li>
              {/each}
            </ul>
          {:else}
            <p class="wait">Waiting on the {b.kind === "final" && view.plan.sudden ? "heats and sudden death" : "heats"}.</p>
          {/if}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .champ {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--ink);
    color: var(--paper);
    border: var(--outline) solid var(--gold);
    box-shadow: 5px 5px 0 var(--gold);
    padding: 12px 16px;
    margin-bottom: 14px;
  }
  .champ div {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .champ-tag {
    font-stretch: 75%;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.8rem;
    color: var(--gold);
  }
  .champ-name {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 2.1rem;
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
    padding-right: 4px;
  }
  .battle {
    border-top: 2px solid #e3e6f3;
    padding: 8px 12px 10px;
  }
  .battle:first-child {
    border-top: 0;
  }
  .battle.live {
    background: color-mix(in srgb, var(--red) 8%, var(--paper));
  }
  .b-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .b-label {
    font-family: var(--font-display);
    font-size: 1.25rem;
    text-transform: uppercase;
    flex: 1;
    padding-right: 3px;
  }
  .final .b-label {
    color: var(--ink);
    text-decoration: underline 4px var(--gold);
    text-underline-offset: 3px;
  }
  .chip,
  .places {
    font-stretch: 75%;
    font-weight: 800;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 8px;
  }
  .chip.live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--red);
    color: var(--paper);
  }
  .chip.next {
    background: var(--gold);
    color: var(--ink);
    border: 2px solid var(--ink);
  }
  .places {
    color: var(--ink-soft);
  }
  ul {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 2px solid #e3e6f3;
  }
  .nm {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 1.1rem;
    text-transform: uppercase;
    padding-right: 0.15em; /* italic overhang */
  }
  li.me .nm {
    text-decoration: underline 3px var(--ink);
    text-underline-offset: 3px;
  }
  li.win {
    background: color-mix(in srgb, var(--gold) 30%, var(--paper));
    border-color: var(--ink);
  }
  li.out {
    opacity: 0.45;
  }
  .tag {
    font-stretch: 75%;
    font-weight: 800;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 1px 6px;
  }
  .tag.win {
    background: var(--gold);
    color: var(--ink);
  }
  .tag.second {
    background: #d9dde9;
  }
  .tag.through {
    background: var(--green);
    color: var(--paper);
  }
  .wait {
    font-size: 0.9rem;
    color: var(--ink-soft);
  }
</style>
