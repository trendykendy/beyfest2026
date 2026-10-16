<script lang="ts">
  // Stand-in for a fighter with no image: a launching blader in silhouette,
  // facing left like the cut-outs, with a hard rim light in --lite. `flip`
  // turns it to face right; the "?" stays readable either way.
  let { flip = false }: { flip?: boolean } = $props();
</script>

<svg class="silhouette" class:flip viewBox="0 0 600 400" aria-hidden="true">
  <ellipse cx="185" cy="78" rx="58" ry="64" />
  <polygon points="150,130 250,95 372,150 332,232 198,242" />
  <polygon points="172,148 218,188 132,282 96,254" />
  <circle cx="106" cy="276" r="40" />
  <polygon points="34,304 108,248 136,282 62,336" />
  <polygon points="298,108 330,136 444,88 432,60" />
  <circle cx="442" cy="72" r="27" />
  <polygon points="298,168 362,148 528,222 506,254" />
  <polygon points="276,214 332,198 478,300 446,324" />
  <text class="mystery" x="185" y="112">?</text>
</svg>

<style>
  .silhouette {
    display: block;
    width: 100%;
    fill: #070816;
    /* a thick round-jointed outline in the same colour softens the shapes */
    stroke: #070816;
    stroke-width: 14;
    stroke-linejoin: round;
    overflow: visible;
    /* hard rim light, up and towards the way it faces */
    filter: drop-shadow(-7px -6px 0 var(--lite));
    transform: scale(0.86);
    transform-origin: 50% 60%;
  }
  .silhouette.flip {
    transform: scale(-0.86, 0.86);
  }
  .mystery {
    font-family: var(--font-display);
    font-size: 110px;
    text-anchor: middle;
    fill: var(--lite);
    stroke: none;
  }
  .flip .mystery {
    transform: scaleX(-1);
    transform-origin: 185px 78px;
  }
</style>
