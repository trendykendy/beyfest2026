<script lang="ts">
  import "$lib/fonts.css";
  import "$lib/theme.css";
  import { page } from "$app/state";

  let { children, data } = $props();

  const isAdmin = $derived(page.url.pathname.startsWith("/admin"));
  const isTv = $derived(page.url.pathname.startsWith("/tv"));
</script>

{#if isTv}
  {@render children()}
{:else}
  <div class="topbar">
    <div class="container bar-inner">
      <a class="brand" href="/">
        <span class="brand-main">BEYFEST 2026</span>
        <span class="brand-sub label">Triple Threat</span>
      </a>
      <nav class="nav">
        <a class:active={!isAdmin} href="/">Display</a>
        <a href="/tv">TV</a>
        {#if data.organiser}
          <a class:active={isAdmin} href="/admin">Admin</a>
        {:else}
          <a class:active={isAdmin} href="/admin/login">Organiser</a>
        {/if}
      </nav>
    </div>
  </div>

  <main>
    {@render children()}
  </main>
{/if}

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--field-deep);
    border-bottom: var(--outline) solid var(--ink);
  }
  .bar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
  }
  .brand {
    display: flex;
    align-items: baseline;
    gap: 10px;
    color: var(--text);
  }
  .brand-main {
    font-family: var(--font-display);
    font-size: 1.6rem;
    letter-spacing: 0.06em;
  }
  .brand-sub {
    font-size: 0.7rem;
    color: var(--gold);
  }
  .nav {
    display: flex;
    gap: 6px;
  }
  .nav a {
    font-family: var(--font-text);
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--muted);
    padding: 8px 14px;
    border-radius: 7px;
  }
  .nav a:hover {
    color: var(--text);
  }
  .nav a.active {
    color: var(--ink);
    background: var(--gold);
  }
  main {
    padding: 32px 0 80px;
  }
</style>
