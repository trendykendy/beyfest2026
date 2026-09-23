<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import { pb } from "$lib/pbBrowser";
  import { STRUCTURES, pickStructure, pointsToWin, miniRRAdvancers } from "@beyfest/engine";
  import { nameMap, slotLabel, hasStage } from "$lib/view";
  import type { PBMatch } from "$lib/view";
  import GroupCard from "$lib/components/GroupCard.svelte";
  import Bracket from "$lib/components/Bracket.svelte";
  import MiniRRTable from "$lib/components/MiniRRTable.svelte";
  import RoundScorer from "$lib/components/RoundScorer.svelte";

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

  // Ready matches (playable now), split into group vs knockout, in play order.
  const readyGroup = $derived(
    data.matches
      .filter((m) => m.stage === "group" && m.matchStatus === "ready")
      .sort((a, b) => a.orderIndex - b.orderIndex),
  );
  const readyKnockout = $derived(
    data.matches
      .filter((m) => m.stage !== "group" && m.matchStatus === "ready")
      .sort((a, b) => a.orderIndex - b.orderIndex),
  );

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

  // Realtime: any change made anywhere refreshes this page.
  onMount(() => {
    const subs = ["tournaments", "groups", "players", "matches"].map((c) =>
      pb().collection(c).subscribe("*", () => invalidateAll()),
    );
    return () => subs.forEach((p) => p.then((unsub) => unsub()).catch(() => {}));
  });
</script>

<div class="container">
  <div class="head">
    <div>
      <h1>Admin</h1>
      {#if data.tournament}
        <p class="sub">
          {data.tournament.name} · {data.tournament.playerCount} players ·
          <span class="status status-{data.tournament.status}">{data.tournament.status.replace("_", " ")}</span>
        </p>
      {/if}
    </div>
    <div class="head-actions">
      {#if data.tournament}
        <form method="POST" action="?/reset" use:enhance={() => async ({ update }) => { if (confirm("Delete this tournament and all results? This cannot be undone.")) await update(); }}>
          <button class="btn danger" type="submit">Reset tournament</button>
        </form>
      {/if}
      <form method="POST" action="?/logout" use:enhance>
        <button class="btn" type="submit">Log out</button>
      </form>
    </div>
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
    <!-- ─────────────── Champion banner ─────────────── -->
    {#if champion}
      <div class="champ">
        <span class="tag">Champion</span>
        <span class="champ-name">🏆 {champion}</span>
      </div>
    {/if}

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

        {#if readyGroup.length}
          <h3 class="play-title">Matches to play ({readyGroup.length} left)</h3>
          <div class="score-list">
            {#each readyGroup as m (m.code)}
              <RoundScorer match={m} p1Name={label(m, 1)} p2Name={label(m, 2)} target={target(m)} />
            {/each}
          </div>
        {:else}
          <p class="all-done">All group matches recorded. Generate the knockout bracket above.</p>
        {/if}

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
        {#if readyKnockout.length}
          <h3 class="play-title">Matches to play</h3>
          <div class="score-list">
            {#each readyKnockout as m (m.code)}
              <RoundScorer match={m} p1Name={label(m, 1)} p2Name={label(m, 2)} target={target(m)} />
            {/each}
          </div>
        {:else if !champion}
          <p class="all-done">Waiting on earlier results…</p>
        {/if}

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
  {/if}
</div>

<style>
  h1 {
    font-size: 2.6rem;
  }
  h2 {
    font-size: 1.9rem;
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }
  .head-actions {
    display: flex;
    gap: 8px;
  }
  .sub {
    color: var(--muted);
  }
  .status {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 20px;
    background: var(--dark3);
  }
  .status-group_stage {
    color: var(--gold);
  }
  .status-knockout {
    color: var(--mb);
  }
  .status-complete {
    color: var(--green);
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
    font-family: "Barlow", sans-serif;
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
  .score-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mcode {
    font-family: "Barlow Condensed", sans-serif;
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
    font-family: "Barlow Condensed", sans-serif;
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
    font-family: "Barlow Condensed", sans-serif;
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
  .champ {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--gf-soft);
    border: 1px solid var(--gf);
    border-radius: var(--radius);
    padding: 16px 22px;
    margin-bottom: 20px;
  }
  .champ .tag {
    color: var(--gf);
    font-size: 0.72rem;
  }
  .champ-name {
    font-family: "Bebas Neue", sans-serif;
    font-size: 2rem;
    letter-spacing: 0.04em;
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
