<script lang="ts">
  import { fighterFor, type PBFighter } from "$lib/fighters";
  import type { PBPlayer } from "$lib/view";

  // Pick a blader to follow: their matches get highlighted on every tab and
  // their next match stays at the top. Names only (no pictures), so the list
  // is quick to load and scroll on a busy venue network.
  let {
    players,
    fighters,
    followId = "",
    onpick,
  }: {
    players: PBPlayer[];
    fighters: PBFighter[];
    followId?: string;
    onpick: (p: PBPlayer | null) => void;
  } = $props();

  const sorted = $derived([...players].sort((a, b) => a.name.localeCompare(b.name)));
</script>

<section>
  <h2 class="lv-h">Follow a blader</h2>
  <p class="lv-note">
    Their matches are highlighted everywhere, and their next match stays at the top. This phone remembers who you
    picked.
  </p>
  {#if followId}
    <button class="stop" onclick={() => onpick(null)}>Stop following</button>
  {/if}
  <div class="lv-slab list">
    {#each sorted as p (p.id)}
      {@const f = fighterFor(p.name, fighters)}
      {@const on = p.id === followId}
      <button class="pick" class:on aria-pressed={on} onclick={() => onpick(on ? null : p)}>
        <span class="who">
          <span class="name">{p.name}</span>
          {#if f || p.withdrawn}
            <span class="sub">
              {#if f}{f.name}{#if f.kana}<span class="kana">{f.kana}</span>{/if}{/if}
              {#if p.withdrawn}<span class="out">Withdrew</span>{/if}
            </span>
          {/if}
        </span>
        <span class="act">{on ? "Following" : "Follow"}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .stop {
    display: block;
    width: 100%;
    min-height: 48px;
    margin-bottom: 14px;
    font-family: var(--font-text);
    font-stretch: 75%;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: transparent;
    color: var(--paper);
    border: 2px solid var(--paper);
    cursor: pointer;
  }
  .list {
    display: flex;
    flex-direction: column;
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 60px;
    padding: 8px 12px;
    background: none;
    border: 0;
    border-top: 2px solid #e3e6f3;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .pick:first-child {
    border-top: 0;
  }
  .pick.on {
    background: color-mix(in srgb, var(--gold) 26%, var(--paper));
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name {
    font-family: var(--font-display);
    font-stretch: 62%;
    font-size: 1.45rem;
    line-height: 1.1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 4px;
  }
  .sub {
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.25;
    color: var(--ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kana {
    margin-left: 8px;
  }
  .out {
    margin-left: 8px;
    color: var(--red);
  }
  .act {
    flex: none;
    font-stretch: 75%;
    font-weight: 800;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 6px 10px;
    border: 2px solid var(--ink);
  }
  .on .act {
    background: var(--ink);
    color: var(--gold);
  }
</style>
