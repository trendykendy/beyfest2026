<script lang="ts">
  import { enhance } from "$app/forms";
  let { form } = $props();
</script>

<div class="container narrow">
  <h1>Organiser Login</h1>
  <p class="hint">Only organisers can enter names and scores. The public display needs no login.</p>

  <form method="POST" use:enhance class="card">
    <label>
      <span class="label">Email</span>
      <input type="email" name="email" value={form?.email ?? "organiser@beyfest.local"} required />
    </label>
    <label>
      <span class="label">Password</span>
      <input type="password" name="password" required />
    </label>
    {#if form?.error}
      <p class="err">{form.error}</p>
    {/if}
    <button class="btn primary" type="submit">Log in</button>
  </form>
</div>

<style>
  .narrow {
    max-width: 420px;
  }
  h1 {
    font-size: 2.6rem;
    margin-bottom: 4px;
  }
  .hint {
    color: var(--muted);
    margin-bottom: 22px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    font-size: 0.72rem;
    color: var(--muted);
  }
  .err {
    color: var(--red);
    font-size: 0.9rem;
  }
</style>
