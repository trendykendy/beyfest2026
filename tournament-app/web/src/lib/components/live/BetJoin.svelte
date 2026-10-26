<script lang="ts">
  import { cleanName, type Bettor } from "$lib/betting";
  import { START_BALANCE } from "$lib/odds";

  // Pick a betting name. The server hands back a token that this phone keeps,
  // so nobody else can bet under the same name.
  let { onjoin, notice = "" }: { onjoin: (b: Bettor) => void; notice?: string } = $props();

  let name = $state("");
  let busy = $state(false);
  let problem = $state("");

  async function join(e: SubmitEvent) {
    e.preventDefault();
    const clean = cleanName(name);
    if (!clean) {
      problem = "Pick a name of 2 to 16 letters.";
      return;
    }
    busy = true;
    problem = "";
    try {
      const res = await fetch("/live/bet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "join", name: clean }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) problem = body.message ?? "Couldn't join. Try again.";
      else onjoin(body as Bettor);
    } catch {
      problem = "No connection. Try again.";
    } finally {
      busy = false;
    }
  }
</script>

<section>
  <h2 class="lv-h">Place your bets</h2>
  <p class="lv-note">
    Everyone starts with ${START_BALANCE.toLocaleString("en-IE")} of play money. Back a blader to win a match: the
    favourite pays less, the underdog pays more, and the odds keep moving while a match is played.
  </p>
  {#if notice}<p class="notice" role="status">{notice}</p>{/if}
  <form class="lv-slab join" onsubmit={join}>
    <label for="bet-name">Your betting name</label>
    <input id="bet-name" bind:value={name} maxlength="16" autocomplete="nickname" placeholder="e.g. Spin Doctor" />
    {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
    <button disabled={busy}>{busy ? "Joining…" : "Start betting"}</button>
  </form>
</section>

<style>
  .join {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }
  label {
    font-stretch: 75%;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.85rem;
  }
  input {
    min-height: 48px;
    padding: 0 12px;
    font: inherit;
    font-size: 1.1rem;
    border: 2px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
  }
  button {
    min-height: 52px;
    font-family: var(--font-display);
    font-size: 1.3rem;
    text-transform: uppercase;
    background: var(--gold);
    color: var(--ink);
    border: 2px solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
  }
  .problem {
    color: var(--red);
    font-weight: 700;
  }
  .notice {
    background: var(--gold);
    color: var(--ink);
    font-weight: 700;
    padding: 10px 12px;
    border: 2px solid var(--ink);
    margin-bottom: 12px;
  }
</style>
