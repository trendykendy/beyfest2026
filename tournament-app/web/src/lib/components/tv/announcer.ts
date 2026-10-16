// Plays the TV's sounds (browser only): the match music and the announcer's
// calls over the VS intro. What to say and when is worked out in lib/sounds.ts.
//
// - Music starts with a match's intro, loops through random tracks, drops
//   while the announcer talks, and fades out when the result is in.
// - Volumes are set on the <audio> elements directly, stepped by a timer:
//   simple, and light enough for a Raspberry Pi.
// - A browser that blocks sound until someone clicks (anything but the Pi's
//   kiosk, which allows autoplay) reports it through `onblocked`; unlock()
//   after a click picks the music back up.

import { CALLS_TAIL, MUSIC, VERSUS, callTimes, pickOther } from "$lib/sounds";

const DUCK = 0.25; // music level while the announcer talks, as a share of normal
const FALLBACK_MS = 1300; // a clip's length if it hasn't loaded yet
const FADE_IN_MS = 600;
const DUCK_MS = 150;
const FADE_OUT_MS = 2500;

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

  // The match's result is in: fade the music out.
  stopMusic() {
    this.wantMusic = false;
    this.cancelCalls();
    const m = this.music;
    if (!m) return;
    this.fadeTo(0, FADE_OUT_MS, () => {
      m.pause();
      if (this.music === m) this.music = null;
    });
  }

  setLevel(level: number) {
    this.level = Math.min(1, Math.max(0, level));
    if (this.music && this.wantMusic) this.fadeTo(this.target(), DUCK_MS);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.stopMusic();
      for (const a of this.clips.values()) a.pause();
    }
  }

  // After a click: the browser now allows sound, so pick the music back up.
  unlock() {
    if (this.wantMusic && this.music?.paused) this.music.play().catch(() => {});
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

  // Step the music's volume to `to` over `ms`.
  private fadeTo(to: number, ms: number, done?: () => void) {
    clearInterval(this.tween);
    const m = this.music;
    if (!m) return;
    const from = m.volume;
    const STEP = 40;
    const steps = Math.max(1, Math.round(ms / STEP));
    let i = 0;
    this.tween = setInterval(() => {
      i++;
      m.volume = Math.min(1, Math.max(0, from + ((to - from) * i) / steps));
      if (i >= steps) {
        clearInterval(this.tween);
        done?.();
      }
    }, STEP);
  }

  private cancelCalls() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
