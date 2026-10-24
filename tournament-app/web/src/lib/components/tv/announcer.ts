// Plays the TV's sounds (browser only): the match music and the announcer's
// calls over the VS intro, each round's finish and "[name] wins!". What to say
// and when is worked out in lib/sounds.ts.
//
// - Music starts with a match's intro, loops through random tracks, and drops
//   while the announcer talks. When the result is in it cuts to the stinger.
// - Volumes are set on the <audio> elements directly, stepped by a timer:
//   simple, and light enough for a Raspberry Pi.
// - A browser that blocks sound until someone clicks (anything but the Pi's
//   kiosk, which allows autoplay) reports it through `onblocked`; unlock()
//   after a click picks the music back up.

import {
  CALLS_GAP,
  CALLS_TAIL,
  CHAMPION_CALL_START,
  CHAMPION_THEME,
  GRAND_CHAMPION,
  MUSIC,
  STINGER,
  STINGER_END_FADE_MS,
  STINGER_END_MS,
  VERSUS,
  callSequence,
  callTimes,
  pickOther,
  stingerDelay,
} from "$lib/sounds";

const DUCK = 0.25; // music level while the announcer talks, as a share of normal
const FALLBACK_MS = 1300; // a clip's length if it hasn't loaded yet
const FADE_IN_MS = 600;
const DUCK_MS = 150;
const FADE_OUT_MS = 2500;
const CUT_MS = 250; // music out under the stinger: a cut, but without a click
const STINGER_OUT_MS = 300; // a new match's music arriving over the stinger
const CHAMP_OUT_MS = 1000; // the champion theme, leaving the Champion scene

// Step an <audio>'s volume to `to` over `ms`. Returns the timer, to cancel it.
function fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = a.volume;
  const STEP = 40;
  const steps = Math.max(1, Math.round(ms / STEP));
  let i = 0;
  const timer = setInterval(() => {
    i++;
    a.volume = Math.min(1, Math.max(0, from + ((to - from) * i) / steps));
    if (i >= steps) {
      clearInterval(timer);
      done?.();
    }
  }, STEP);
  return timer;
}

export class Announcer {
  // Sound off: no music and no calls; the intro keeps its normal length.
  enabled = true;
  onblocked: (() => void) | null = null;

  private level = 0.6; // normal music volume, 0–1
  private clips = new Map<string, HTMLAudioElement>();
  private music: HTMLAudioElement | null = null;
  private track: string | null = null;
  private versus: string | null = null;
  private wantMusic = false;
  private ducked = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private tween: ReturnType<typeof setInterval> | undefined;
  private callsEnd = 0; // when the match calls queued so far finish (Date.now() ms)
  private unduck: ReturnType<typeof setTimeout> | undefined;
  private stinger: HTMLAudioElement | null = null;
  private stingerTween: ReturnType<typeof setInterval> | undefined;
  private stingerEnd: ReturnType<typeof setTimeout> | undefined;

  // Load a clip ahead of time, so its length is known and it plays on cue.
  preload(url: string) {
    if (!url || this.clips.has(url)) return;
    const a = new Audio(url);
    a.preload = "auto";
    this.clips.set(url, a);
  }

  private lengthOf(url: string): number {
    const d = this.clips.get(url)?.duration;
    return d && Number.isFinite(d) ? d * 1000 : FALLBACK_MS;
  }

  // Start the music and schedule the intro's calls (empty URLs are skipped).
  // Returns when the intro's banners should split apart, in ms.
  intro(calls: string[]): number {
    this.cancelCalls();
    if (!this.enabled) return callTimes([]).out;
    const list = calls.filter(Boolean);
    list.forEach((u) => this.preload(u));
    const { starts, out } = callTimes(list.map((u) => this.lengthOf(u)));
    this.startMusic();
    if (list.length) {
      this.setDucked(true);
      list.forEach((u, i) => this.timers.push(setTimeout(() => this.play(u), starts[i])));
      this.timers.push(setTimeout(() => this.setDucked(false), out - CALLS_TAIL));
    }
    return out;
  }

  // A "versus" take, never the same one twice running.
  nextVersus(): string {
    this.versus = pickOther(VERSUS, this.versus);
    return this.versus;
  }

  // No result to end on (the match vanished, or sound went off): fade out.
  stopMusic() {
    this.wantMusic = false;
    this.cancelCalls();
    this.musicOut(FADE_OUT_MS);
  }

  // A round was logged: call its finish over the music.
  call(calls: string[]) {
    if (this.enabled) this.queue(calls);
  }

  // The match's result is in: call the winner (after any call still going),
  // then, if this match's music is playing, cut it and hit the stinger. The
  // music stays ducked under the calls right up to the cut.
  endMatch(calls: string[], withMusic: boolean) {
    if (!this.enabled) return;
    const talking = this.queue(calls);
    if (!withMusic) return;
    clearTimeout(this.unduck);
    this.timers.push(setTimeout(() => this.hitStinger(), stingerDelay(talking)));
  }

  // Hand the room over to something else (the Champion scene): drop any match
  // calls still to come, and fade out the match music and the stinger. Safe
  // to call at any time, playing or not.
  silenceMatch(ms = 400) {
    this.wantMusic = false;
    this.cancelCalls();
    this.musicOut(ms);
    this.fadeStinger(ms);
  }

  // Both are called on every data reload; only a real change does anything.
  setLevel(level: number) {
    level = Math.min(1, Math.max(0, level));
    if (level === this.level) return;
    this.level = level;
    if (this.music && this.wantMusic) this.fadeTo(this.target(), DUCK_MS);
    if (this.stinger && !this.stinger.paused) this.stinger.volume = level;
    this.champLevelChanged();
  }

  setEnabled(on: boolean) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) {
      this.stopMusic();
      for (const a of this.clips.values()) a.pause();
    }
    this.champEnabledChanged();
  }

  // After a click: the browser now allows sound, so pick the music back up.
  unlock() {
    if (this.wantMusic && this.music?.paused) this.music.play().catch(() => {});
    this.unlockChampion();
  }

  private target() {
    return this.level * (this.ducked ? DUCK : 1);
  }

  private play(url: string) {
    const a = this.clips.get(url);
    if (!a || !this.enabled) return;
    a.currentTime = 0;
    a.play().catch((e) => this.failed(e));
  }

  private failed(e: unknown) {
    if (e instanceof DOMException && e.name === "NotAllowedError") this.onblocked?.();
  }

  private startMusic() {
    this.wantMusic = true;
    this.fadeStinger(STINGER_OUT_MS);
    // Already playing (a new match started before the last result): carry on.
    if (this.music && !this.music.paused) return void this.fadeTo(this.target(), FADE_IN_MS);
    this.track = pickOther(MUSIC, this.track);
    const m = new Audio(this.track);
    m.volume = 0;
    // When a track ends, the next one starts (never the same twice running).
    m.onended = () => {
      if (this.music === m && this.wantMusic) this.startMusic();
    };
    this.music = m;
    m.play().catch((e) => this.failed(e));
    this.fadeTo(this.target(), FADE_IN_MS);
  }

  private setDucked(on: boolean) {
    this.ducked = on;
    if (this.music && this.wantMusic) this.fadeTo(this.target(), DUCK_MS);
  }

  // Queue match calls after anything the announcer is still saying, with the
  // music ducked until they're done. Returns how long until it's quiet, in ms.
  private queue(calls: string[]): number {
    const list = calls.filter(Boolean);
    list.forEach((u) => this.preload(u));
    const now = Date.now();
    const busy = Math.max(0, this.callsEnd - now);
    if (!list.length) return busy;
    const { starts, end } = callSequence(
      list.map((u) => this.lengthOf(u)),
      busy ? busy + CALLS_GAP : 0,
    );
    this.setDucked(true);
    list.forEach((u, i) => this.timers.push(setTimeout(() => this.play(u), starts[i])));
    clearTimeout(this.unduck);
    this.unduck = setTimeout(() => this.setDucked(false), end);
    this.callsEnd = now + end;
    return end;
  }

  // Cut the match music and play the stinger, at the music's level, until
  // just before the cut-off note at the end of its file.
  private hitStinger() {
    this.wantMusic = false;
    this.ducked = false;
    this.musicOut(CUT_MS);
    this.preload(STINGER);
    const s = this.clips.get(STINGER)!;
    clearInterval(this.stingerTween);
    s.volume = this.level;
    this.stinger = s;
    this.play(STINGER);
    clearTimeout(this.stingerEnd);
    this.stingerEnd = setTimeout(() => {
      if (this.stinger === s) this.fadeStinger(STINGER_END_FADE_MS);
    }, STINGER_END_MS);
  }

  private fadeStinger(ms: number) {
    const s = this.stinger;
    this.stinger = null;
    if (!s || s.paused) return;
    clearInterval(this.stingerTween);
    this.stingerTween = fade(s, 0, ms, () => s.pause());
  }

  // Fade the match music out over `ms`, then let it go.
  private musicOut(ms: number) {
    const m = this.music;
    if (!m) return;
    this.fadeTo(0, ms, () => {
      m.pause();
      if (this.music === m) this.music = null;
    });
  }

  // Step the music's volume to `to` over `ms`.
  private fadeTo(to: number, ms: number, done?: () => void) {
    clearInterval(this.tween);
    if (this.music) this.tween = fade(this.music, to, ms, done);
  }

  // Every duck belongs to a run of calls, so dropping the calls ends it too.
  private cancelCalls() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    clearTimeout(this.unduck);
    this.callsEnd = 0;
    this.ducked = false;
  }

  // ── Champion ──
  // The Champion scene has its own music (the champion theme, looped for as
  // long as the scene is up, from the top each time it comes up) and its own
  // one-off call, which the page decides on. Either one silences match audio.
  private champWanted = false; // the Champion scene is on screen
  private champTheme: HTMLAudioElement | null = null;
  private champDucked = false;
  private champCalls: string[] = [];
  private champTimers: ReturnType<typeof setTimeout>[] = [];
  private champTween: ReturnType<typeof setInterval> | undefined;

  // Load the theme and the title call before the scene first needs them.
  preloadChampion() {
    this.preload(GRAND_CHAMPION);
    if (this.champTheme) return;
    const a = new Audio(CHAMPION_THEME);
    a.preload = "auto";
    a.loop = true; // an organiser can lock the scene on for longer than the track
    a.volume = 0;
    this.champTheme = a;
  }

  // The Champion scene came up: fade the theme in and make any calls over it
  // (empty URLs are skipped), with the theme ducked until they're done.
  startChampion(calls: string[]) {
    this.champWanted = true;
    this.cancelChampCalls();
    if (!this.enabled) return;
    this.silenceMatch(400);
    const list = calls.filter(Boolean);
    list.forEach((u) => this.preload(u));
    const { starts, end } = callSequence(
      list.map((u) => this.lengthOf(u)),
      CHAMPION_CALL_START,
    );
    this.champCalls = list;
    this.champDucked = list.length > 0;
    this.playChampTheme();
    list.forEach((u, i) => this.champTimers.push(setTimeout(() => this.play(u), starts[i])));
    if (list.length) {
      // Swell back up after the call, a touch slower than the intro's ducking.
      this.champTimers.push(
        setTimeout(() => {
          this.champDucked = false;
          this.champFade(this.champTarget(), FADE_IN_MS);
        }, end + CALLS_TAIL),
      );
    }
  }

  // Off the Champion scene: cut a call short and fade the theme out.
  stopChampion() {
    this.champWanted = false;
    this.cancelChampCalls();
    const a = this.champTheme;
    if (a && !a.paused) this.champFade(0, CHAMP_OUT_MS, () => a.pause());
  }

  // Hooks from setLevel / setEnabled / unlock, so the theme follows them.
  private champLevelChanged() {
    if (this.champWanted && this.champTheme && !this.champTheme.paused) this.champFade(this.champTarget(), DUCK_MS);
  }

  private champEnabledChanged() {
    if (!this.enabled) {
      this.cancelChampCalls();
      const a = this.champTheme;
      if (a && !a.paused) this.champFade(0, CHAMP_OUT_MS, () => a.pause());
    } else if (this.champWanted) {
      // Sound turned back on while the scene is up: the theme, no call.
      this.champDucked = false;
      this.playChampTheme();
    }
  }

  private unlockChampion() {
    if (this.enabled && this.champWanted && this.champTheme?.paused) this.champTheme.play().catch(() => {});
  }

  private champTarget() {
    return this.level * (this.champDucked ? DUCK : 1);
  }

  // From the top, like the scene's own reveal.
  private playChampTheme() {
    this.preloadChampion();
    const a = this.champTheme!;
    a.currentTime = 0;
    a.volume = 0;
    a.play().catch((e) => this.failed(e));
    this.champFade(this.champTarget(), FADE_IN_MS);
  }

  // Step the theme's volume to `to` over `ms`. Its own timer, so it never
  // fights the match music's fades.
  private champFade(to: number, ms: number, done?: () => void) {
    clearInterval(this.champTween);
    if (this.champTheme) this.champTween = fade(this.champTheme, to, ms, done);
  }

  private cancelChampCalls() {
    this.champTimers.forEach(clearTimeout);
    this.champTimers = [];
    for (const u of this.champCalls) this.clips.get(u)?.pause();
    this.champCalls = [];
  }
}
