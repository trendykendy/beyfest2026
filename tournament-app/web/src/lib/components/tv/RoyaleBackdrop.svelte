<script lang="ts">
  // The battle royale screens' backdrop, dressed like the winner screen's:
  // fine diagonal pinstripes, a gold glow round the title, and gold rays
  // turning slowly behind it (the idle motion while a screen holds).
  // Sits inside a 1920×1080 canvas whose --k is the timing multiplier.
  // outAt: ms when it fades out with the rest (RoyaleIntro); null never.
  // leaving: fade out now (QualifiedScreen's exit).
  let {
    rayY = 200, // canvas px: the rays' centre, the title's middle
    raysAt = 150, // ms: the rays fade in with the title's slam
    outAt = null,
    leaving = false,
    lite = false,
  }: { rayY?: number; raysAt?: number; outAt?: number | null; leaving?: boolean; lite?: boolean } = $props();
</script>

<div class="rb" class:out={outAt != null} class:leaving class:lite style:--out="{outAt ?? 0}ms" style:--rays-at="{raysAt}ms">
  <div class="back"></div>
  <div class="rays-wrap" style:top="{rayY}px"><div class="rays"></div></div>
</div>

<style>
  .rb {
    position: absolute;
    inset: 0;
  }
  .back {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 45% at 50% 18%, rgb(255 199 0 / 0.22), transparent 70%),
      repeating-linear-gradient(-60deg, rgb(255 255 255 / 0.035) 0 2px, transparent 2px 16px),
      var(--field-deep);
    animation: fade-in calc(200ms * var(--k)) ease-out both;
  }
  .rays-wrap {
    position: absolute;
    left: 960px;
    width: 0;
    height: 0;
    opacity: 0;
    animation: fade-in-to calc(500ms * var(--k)) ease-out calc(var(--rays-at) * var(--k)) forwards;
  }
  .rays {
    position: absolute;
    left: -1100px;
    top: -1100px;
    width: 2200px;
    height: 2200px;
    background: repeating-conic-gradient(rgb(255 226 122 / 0.3) 0deg 6deg, transparent 6deg 15deg);
    mask-image: radial-gradient(circle, #000 10%, transparent 42%);
    animation: spin calc(24000ms * var(--k)) linear infinite;
  }

  /* Clearing with the rest of the screen. */
  .out {
    animation: fade-out calc(400ms * var(--k)) ease-in calc(var(--out) * var(--k)) forwards;
  }
  .leaving {
    animation: fade-out calc(300ms * var(--k)) ease-in calc(300ms * var(--k)) forwards;
  }

  /* Pi-safe: the rays stand still (a turning 2200px layer repaints a lot). */
  .lite .rays {
    animation: none;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  @keyframes fade-in-to {
    to {
      opacity: 1;
    }
  }
  @keyframes fade-out {
    to {
      opacity: 0;
    }
  }
  @keyframes spin {
    to {
      rotate: 360deg;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rays {
      animation: none;
    }
  }
</style>
