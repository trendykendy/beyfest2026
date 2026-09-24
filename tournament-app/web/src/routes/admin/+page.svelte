<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import { pb } from "$lib/pbBrowser";
  import { STRUCTURES, pickStructure, pointsToWin, miniRRAdvancers } from "@beyfest/engine";
  import { nameMap, slotLabel, hasStage, availableScenes, SCENE_TITLE, isLive, matchContext, tierOf } from "$lib/view";
  import type { PBMatch } from "$lib/view";
  import GroupCard from "$lib/components/GroupCard.svelte";
  import Bracket from "$lib/components/Bracket.svelte";
  import MiniRRTable from "$lib/components/MiniRRTable.svelte";
  import RoundScorer from "$lib/components/RoundScorer.svelte";
  import Trophy from "$lib/components/Trophy.svelte";

  let { data, form } = $props();

  const structure = $derived(data.tournament ? pickStructure(data.tournament.structureKey) : null);
  const groupCount = $derived(data.groups.length);
  const names = $derived(nameMap(data.players));

  const allGroupsComplete = $derived(
    data.groups.length > 0 && data.groups.every((g) => g.complete),
  );
  const hasKnockout = $derived(data.matches.some((m) => m.stage !== "group"));
  const champion = $derived.by(() => {
    const gf = data.matches.find((m) => m.stage === "gf");
    return gf && gf.matchStatus === "done" ? names.get(gf.winner) : null;
  });

  // One match is played at a time. Now playing is the one the organiser picked,
  // else the one already under way, else the next playable one in play order;
  // recording a result moves it on by itself.
  const playable = $derived(
    data.matches.filter((m) => m.matchStatus === "ready").sort((a, b) => a.orderIndex - b.orderIndex),
  );
  let chosenCode = $state<string | null>(null);
  const current = $derived(
    playable.find((m) => m.code === chosenCode) ?? playable.find(isLive) ?? playable[0] ?? null,
  );
  const upNext = $derived(playable.filter((m) => m.code !== current?.code));
  const waiting = $derived(data.matches.filter((m) => m.matchStatus === "pending").length);

  // Full group-stage schedule in play order, for the read-only Fixtures panel.
  const fixtures = $derived(
    data.matches
      .filter((m) => m.stage === "group")
      .sort((a, b) => a.orderIndex - b.orderIndex),
  );
  const nextUpCode = $derived(fixtures.find((m) => m.matchStatus !== "done")?.code ?? null);
  const groupNameByIndex = $derived(new Map(data.groups.map((g) => [g.index, g.name])));

  // Live create-form preview.
  let playersText = $state("");
  const enteredCount = $derived(
    playersText.split(/[\n,]/).map((n) => n.trim()).filter(Boolean).length,
  );
  const previewStructure = $derived(STRUCTURES[enteredCount] ?? null);

  function label(m: PBMatch, which: 1 | 2): string {
    const pid = which === 1 ? m.p1 : m.p2;
    if (pid) return names.get(pid) ?? "—";
    return slotLabel(which === 1 ? m.slot1 : m.slot2, groupCount);
  }

  const target = (m: PBMatch) => pointsToWin(m.stage, m.roundLabel);
  const STAGE_NAME: Record<string, string> = {
    group_stage: "Group stage",
    knockout: "Knockout",
    complete: "Complete",
  };

  // Scenes the organiser can put on the TV right now.
  const tvScenes = $derived(availableScenes(!!data.tournament, data.matches).filter((s) => s !== "standby"));

  // Realtime: any change made anywhere refreshes this page.
  onMount(() => {
    const subs = ["tournaments", "groups", "players", "matches", "tv_state"].map((c) =>
      pb().collection(c).subscribe("*", () => invalidateAll()),
    );
    return () => subs.forEach((p) => p.then((unsub) => unsub()).catch(() => {}));
  });
</script>

<div class="container">
  <div class="head">
    {#if data.tournament}
      <span class="stage stage-{data.tournament.status}">{STAGE_NAME[data.tournament.status] ?? data.tournament.status}</span>
      <span class="head-name">{data.tournament.name}</span>
      <span class="head-count">{data.tournament.playerCount} bladers</span>
    {:else}
      <span class="head-name">No tournament yet</span>
    {/if}
    <form method="POST" action="?/logout" use:enhance class="logout">
      <button class="btn" type="submit">Log out</button>
    </form>
  </div>

  {#if form?.error}
    <div class="banner err">{form.error}</div>
  {/if}

  <!-- ─────────────── No tournament: create ─────────────── -->
  {#if !data.tournament}
    <section class="panel">
      <h2>New tournament</h2>
      <p class="hint">
        Enter the players who showed up — one per line (or comma-separated). Between 8 and 15.
        The groups are drawn randomly and the correct bracket is generated automatically.
      </p>
      <form method="POST" action="?/create" use:enhance class="create-form">
        <label>
          <span class="label">Tournament name</span>
          <input type="text" name="name" value={form?.name ?? "Beyfest 2026 — Triple Threat"} />
        </label>
        <label>
          <span class="label">Players ({enteredCount})</span>
          <textarea name="players" rows="10" bind:value={playersText} placeholder={"Blader One\nBlader Two\nBlader Three\n…"}></textarea>
        </label>

        <div class="preview">
          {#if enteredCount < 8}
            <span class="muted">Need at least 8 players ({8 - enteredCount} more).</span>
          {:else if enteredCount > 15}
            <span class="warn">Too many — max 15 ({enteredCount - 15} over).</span>
          {:else if previewStructure}
            <span class="ok">
              {enteredCount} players → {previewStructure.groups.join(" / ")} groups,
              {previewStructure.roundRobin} round robin.
            </span>
          {/if}
        </div>

        <button class="btn primary" type="submit" disabled={enteredCount < 8 || enteredCount > 15}>
          Draw groups &amp; build bracket
        </button>
      </form>
    </section>
  {:else}
    <!-- ─────────────── Now playing + Up next ─────────────── -->
    <div class="play">
      <section class="now">
        {#if champion}
          <h2 class="kicker">Champion</h2>
          <div class="champ"><Trophy /> <span>{champion}</span></div>
        {:else}
          <h2 class="kicker">Now playing</h2>
          {#if current}
            <!-- Keyed so switching matches starts that match's own scorer. -->
            {#key current.code}
              <RoundScorer
                match={current}
                p1Name={label(current, 1)}
                p2Name={label(current, 2)}
                target={target(current)}
                context={matchContext(current, data.matches)}
                tier={tierOf(current.stage)}
              />
            {/key}
          {:else if !hasKnockout && allGroupsComplete}
            <p class="all-done">All group matches are in. Generate the knockout bracket to carry on.</p>
          {:else}
            <p class="all-done">Waiting on earlier results.</p>
          {/if}
        {/if}
      </section>

      <aside class="queue">
        <!-- What the venue TV shows. Auto rotates and cuts to live scores. -->
        <section class="tv">
          <h2 class="kicker">TV screen</h2>
          <form method="POST" action="?/tv" use:enhance class="tv-buttons">
            <button class="tv-btn" class:on={data.tv.mode === "auto"} name="mode" value="auto">Auto</button>
            {#each tvScenes as sc (sc)}
              <button class="tv-btn" class:on={data.tv.mode === "locked" && data.tv.scene === sc} name="scene" value={sc}>
                {SCENE_TITLE[sc]}
              </button>
            {/each}
          </form>
          <p class="tv-now">
            {#if data.tv.mode === "auto"}
              Rotating, and cutting to Match centre when a score changes.
            {:else}
              Locked on {SCENE_TITLE[data.tv.scene]}. Press Auto to rotate again.
            {/if}
          </p>
        </section>

        {#if !champion}
          <h2 class="kicker">Up next</h2>
          {#if upNext.length}
            <ol class="queue-list">
              {#each upNext as m (m.code)}
                <li class="q-row tier-{tierOf(m.stage)}">
                  <div class="q-info">
                    <span class="q-context">{matchContext(m, data.matches)}</span>
                    <span class="q-names">{label(m, 1)} <i>v</i> {label(m, 2)}</span>
                  </div>
                  <button type="button" class="q-pick" onclick={() => (chosenCode = m.code)}>
                    {isLive(m) ? "Resume" : "Score this"}
                  </button>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="q-empty">Nothing else is ready to play.</p>
          {/if}
          {#if waiting}
            <p class="q-empty">{waiting} more {waiting === 1 ? "match is" : "matches are"} waiting on earlier results.</p>
          {/if}
        {/if}
      </aside>
    </div>

    <!-- ─────────────── Group stage ─────────────── -->
    {#if !hasKnockout}
      <section>
        <div class="section-head">
          <h2>Group Stage</h2>
          <form method="POST" action="?/generateKnockout" use:enhance>
            <button class="btn primary" type="submit" disabled={!allGroupsComplete}>
              {allGroupsComplete ? "Generate knockout bracket" : "Finish all groups first"}
            </button>
          </form>
        </div>

        <div class="groups-grid">
          {#each data.groups as group (group.id)}
            <GroupCard {group} players={data.players} matches={data.matches} knockoutType={structure?.knockoutType ?? ""} />
          {/each}
        </div>

        {#if fixtures.length}
          <h3 class="play-title">Fixtures</h3>
          <p class="fixtures-hint">Full group-stage schedule in play order.</p>
          <div class="fixtures">
            {#each fixtures as m (m.code)}
              {@const done = m.matchStatus === "done"}
              <div class="fixture-row" class:done class:next={m.code === nextUpCode}>
                <span class="mcode">{m.code}</span>
                <span class="fgroup">{groupNameByIndex.get(m.groupIndex ?? -1) ?? `Group ${(m.groupIndex ?? 0) + 1}`}</span>
                <span class="pn">{names.get(m.p1) ?? "—"}</span>
                <span class="fresult">
                  {#if done}
                    <span class="fscore" class:win1={(m.p1Score ?? 0) > (m.p2Score ?? 0)}>{m.p1Score}</span>
                    <span class="vs">–</span>
                    <span class="fscore" class:win2={(m.p2Score ?? 0) > (m.p1Score ?? 0)}>{m.p2Score}</span>
                  {:else if m.code === nextUpCode}
                    <span class="next-chip">Next up</span>
                  {:else}
                    <span class="vs">vs</span>
                  {/if}
                </span>
                <span class="pn right">{names.get(m.p2) ?? "—"}</span>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {:else}
      <!-- ─────────────── Knockout stage ─────────────── -->
      <section>
        <h2>Knockout</h2>
        {#if structure && (hasStage(data.matches, "wb_rr") || hasStage(data.matches, "lb_rr"))}
          <h3 class="play-title">Mini Round-Robins</h3>
          <div class="rr-row">
            {#if hasStage(data.matches, "wb_rr")}
              <MiniRRTable matches={data.matches} players={data.players} stage="wb_rr" advancers={miniRRAdvancers(structure, "wb_rr")} />
            {/if}
            {#if hasStage(data.matches, "lb_rr")}
              <MiniRRTable matches={data.matches} players={data.players} stage="lb_rr" advancers={miniRRAdvancers(structure, "lb_rr")} />
            {/if}
          </div>
        {/if}

        <h3 class="play-title">Bracket</h3>
        <Bracket matches={data.matches} players={data.players} {groupCount} />
      </section>
    {/if}

    <!-- Kept well away from everything else: it wipes the whole tournament. -->
    <section class="danger-zone">
      <div>
        <h2>Danger zone</h2>
        <p>Reset deletes this tournament and every result. It can't be undone.</p>
      </div>
      <form method="POST" action="?/reset" use:enhance={() => async ({ update }) => { if (confirm("Delete this tournament and all results? This cannot be undone.")) await update(); }}>
        <button class="btn danger" type="submit">Reset tournament</button>
      </form>
    </section>
  {/if}
</div>

<style>
  h2 {
    font-size: 1.9rem;
  }
  /* Slim status row: stage tag, name, count … Log out. */
  .head {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 22px;
    font-size: 1.1rem;
  }
  .stage {
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.2rem;
    line-height: 1;
    padding: 6px 16px 8px;
    background: var(--ink);
    color: var(--paper);
    clip-path: polygon(var(--cut) 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%);
  }
  .stage-group_stage,
  .stage-knockout {
    background: var(--gold);
    color: var(--ink);
  }
  .stage-complete {
    background: var(--green);
    color: var(--ink);
  }
  .head-name {
    font-weight: 700;
  }
  .head-count {
    color: var(--on-field-soft);
  }
  .logout {
    margin-left: auto;
  }
  /* TV control: a stack of scene buttons, the live one lit gold. */
  .tv {
    margin-bottom: 28px;
  }
  .tv-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .tv-btn {
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 0.95rem;
    text-align: left;
    padding: 9px 12px;
    background: var(--field);
    color: var(--paper);
    border: 2px solid var(--field-line);
    cursor: pointer;
  }
  .tv-btn:hover {
    border-color: var(--paper);
  }
  .tv-btn.on {
    background: var(--gold);
    color: var(--ink);
    border-color: var(--ink);
  }
  .tv-now {
    color: var(--on-field-soft);
    font-size: 0.9rem;
    margin-top: 8px;
  }
  .banner.err {
    background: var(--lb-soft);
    border: 1px solid var(--red);
    color: var(--text);
    padding: 10px 14px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    max-width: 620px;
  }
  .hint {
    color: var(--muted);
    margin: 6px 0 16px;
  }
  .create-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    font-size: 0.72rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  textarea {
    resize: vertical;
    font-family: var(--font-text);
  }
  .preview {
    font-size: 0.9rem;
  }
  .preview .ok {
    color: var(--green);
  }
  .preview .warn {
    color: var(--red);
  }
  .preview .muted {
    color: var(--muted);
  }
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .play-title {
    font-size: 1.4rem;
    margin: 18px 0 10px;
  }
  /* Now playing (wide) beside Up next (narrow). */
  .play {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 28px;
    align-items: start;
    margin-bottom: 36px;
  }
  .kicker {
    font-size: 1.5rem;
    margin-bottom: 14px;
  }
  .queue-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 560px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .q-row {
    --tier: var(--on-field-soft);
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--paper);
    color: var(--ink);
    border: 2px solid var(--ink);
    border-left: 8px solid var(--tier);
    padding: 8px 10px;
  }
  .q-row.tier-wb {
    --tier: var(--wb);
  }
  .q-row.tier-mb {
    --tier: var(--mb);
  }
  .q-row.tier-lb {
    --tier: var(--lb);
  }
  .q-row.tier-gf {
    --tier: var(--ink);
  }
  .q-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .q-context {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .q-names {
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 1.35rem;
    line-height: 1.05;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 0.1em;
  }
  .q-names i {
    font-style: normal;
    color: var(--ink-soft);
    font-size: 0.8em;
  }
  .q-pick {
    flex: none;
    font-family: var(--font-text);
    font-weight: 700;
    font-size: 0.85rem;
    background: var(--ink);
    color: var(--paper);
    border: none;
    padding: 8px 12px;
    cursor: pointer;
  }
  .q-pick:hover {
    background: var(--gold);
    color: var(--ink);
  }
  .q-empty {
    color: var(--on-field-soft);
    margin-top: 10px;
  }
  .mcode {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rr-row {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-bottom: 8px;
  }
  .pn {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pn.right {
    text-align: right;
  }
  .vs {
    text-align: center;
    color: var(--muted);
  }
  .all-done {
    color: var(--muted);
    padding: 10px 0;
  }
  .fixtures-hint {
    color: var(--muted);
    font-size: 0.85rem;
    margin: -4px 0 10px;
  }
  .fixtures {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fixture-row {
    display: grid;
    grid-template-columns: 54px 84px 1fr 92px 1fr;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 10px;
  }
  .fixture-row.done {
    opacity: 0.72;
  }
  .fixture-row.next {
    border-color: var(--gold);
    background: var(--mb-soft);
    opacity: 1;
  }
  .fgroup {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fresult {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .fscore {
    font-weight: 700;
    color: var(--muted);
  }
  .fscore.win1,
  .fscore.win2 {
    color: var(--text);
  }
  .next-chip {
    font-family: var(--font-text);
    font-stretch: 75%;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 20px;
    color: var(--gold);
    border: 1px solid color-mix(in oklch, var(--gold) 50%, transparent);
    background: color-mix(in oklch, var(--gold) 14%, transparent);
    white-space: nowrap;
  }
  /* The champion, as the TV shows it: the big gold slab. */
  .champ {
    display: inline-flex;
    align-items: center;
    gap: 22px;
    background: var(--gold);
    color: var(--ink);
    border: 4px solid var(--ink);
    box-shadow: 10px 10px 0 var(--ink);
    padding: 14px 36px 16px;
    font-family: var(--font-display);
    font-stretch: 62%;
    text-transform: uppercase;
    font-size: 5rem;
    line-height: 1;
  }
  .danger-zone {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-top: 56px;
    padding: 18px 22px;
    border: 2px dashed var(--red);
  }
  .danger-zone h2 {
    font-size: 1.4rem;
    color: var(--red);
  }
  .danger-zone p {
    color: var(--on-field-soft);
  }
  @media (max-width: 640px) {
    .fixture-row {
      grid-template-columns: 44px 1fr 70px 1fr;
      row-gap: 2px;
    }
    .fgroup {
      grid-column: 1 / -1;
    }
  }
</style>
