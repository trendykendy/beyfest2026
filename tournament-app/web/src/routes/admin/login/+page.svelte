<script lang="ts">
  import { enhance } from "$app/forms";
  let { form } = $props();
</script>

<div class="container narrow">
  <!-- Same build as the admin's New tournament card: a white slab with a
       black header bar. -->
  <form method="POST" use:enhance class="card">
    <header class="card-head"><h1>Organiser login</h1></header>
    <div class="card-body">
      <p class="hint">Only organisers enter names and scores. The TV and the public display don't need a login.</p>
      <label>
        <span class="field">Email</span>
        <input type="email" name="email" value={form?.email ?? "organiser@beyfest.local"} required />
      </label>
      <label>
        <span class="field">Password</span>
        <input type="password" name="password" required />
      </label>
      {#if form?.error}
        <p class="err">{form.error}</p>
      {/if}
      <button class="go" type="submit">Log in</button>
    </div>
  </form>
</div>

<style>
  .narrow {
    max-width: 460px;
    padding-top: 40px;
  }
  .card {
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);
  }
  .card-head {
    background: var(--ink);
    color: var(--paper);
    padding: 12px 20px 14px;
  }
  h1 {
    font-size: 2rem;
  }
  .card-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px 20px 24px;
  }
  .hint {
    color: var(--ink-soft);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field {
    font-weight: 700;
  }
  input {
    background: var(--paper);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    border-radius: 0;
    font-size: 1.05rem;
  }
  input:focus {
    outline: 3px solid var(--gold);
  }
  .err {
    color: var(--red);
    font-weight: 700;
  }
  .go {
    min-height: 60px;
    font-family: var(--font-display);
    text-transform: uppercase;
    font-size: 1.7rem;
    background: var(--gold);
    color: var(--ink);
    border: var(--outline) solid var(--ink);
    box-shadow: 4px 4px 0 var(--ink);
    cursor: pointer;
  }
  .go:active {
    transform: translate(3px, 3px);
    box-shadow: 1px 1px 0 var(--ink);
  }
</style>
