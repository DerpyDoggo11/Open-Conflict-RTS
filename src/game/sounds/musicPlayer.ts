export interface MusicOptions {
  volume?: number;
  fadeDuration?: number;
}

export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private currentPath: string | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private targetVolume = 0.5;
  private fadeTimer: number | null = null;
  private resumed = false;

  constructor() {}

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
      this.gainNode.gain.value = 0;
    }

    if (!this.resumed && this.ctx.state === 'suspended') {
      const resume = () => {
        this.ctx?.resume();
        this.resumed = true;
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
        window.removeEventListener('click', resume);
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
      window.addEventListener('click', resume);
    }

    return this.ctx;
  }

  private waitForResume(ctx: AudioContext): Promise<void> {
    if (ctx.state === 'running') return Promise.resolve();

    return new Promise(resolve => {
      const handler = () => {
        if (ctx.state === 'running') {
          window.removeEventListener('pointerdown', handler);
          window.removeEventListener('keydown', handler);
          window.removeEventListener('click', handler);
          resolve();
        }
      };
      window.addEventListener('pointerdown', handler);
      window.addEventListener('keydown', handler);
      window.addEventListener('click', handler);
    });
  }

  private async loadBuffer(path: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(path)) return this.bufferCache.get(path)!;

    const ctx = this.ensureContext();
    try {
      const resp = await fetch(path);
      const arrayBuf = await resp.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      this.bufferCache.set(path, audioBuf);
      return audioBuf;
    } catch (e) {
      console.warn(`[MusicPlayer] Failed to load ${path}:`, e);
      return null;
    }
  }

  async play(path: string, options: MusicOptions = {}): Promise<void> {
    const volume = options.volume ?? 0.5;
    const fadeDuration = options.fadeDuration ?? 1000;
    this.targetVolume = volume;

    const ctx = this.ensureContext();

    await this.waitForResume(ctx);

    if (this.currentPath === path && this.source) {
      this.fadeTo(volume, fadeDuration);
      return;
    }

    const buffer = await this.loadBuffer(path);
    if (!buffer) return;

    if (this.source) {
      await this.fadeOut(fadeDuration / 2);
      this.stopSource();
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.gainNode!);

    this.source = source;
    this.currentPath = path;

    this.gainNode!.gain.value = 0;
    source.start();

    this.fadeTo(volume, fadeDuration / 2);
  }

  stop(fadeDuration = 800): void {
    if (!this.source) return;
    this.fadeOut(fadeDuration).then(() => this.stopSource());
  }

  setVolume(volume: number, fadeDuration = 300): void {
    this.targetVolume = Math.max(0, Math.min(1, volume));
    this.fadeTo(this.targetVolume, fadeDuration);
  }

  get isPlaying(): boolean {
    return this.source !== null;
  }

  get currentTrack(): string | null {
    return this.currentPath;
  }

  private stopSource(): void {
    try { this.source?.stop(); } catch {}
    try { this.source?.disconnect(); } catch {}
    this.source = null;
    this.currentPath = null;
  }

  private fadeTo(targetVol: number, durationMs: number): void {
    if (this.fadeTimer !== null) {
      cancelAnimationFrame(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (!this.gainNode) return;

    const startVol = this.gainNode.gain.value;
    const startTime = performance.now();

    const step = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / Math.max(1, durationMs));
      this.gainNode!.gain.value = startVol + (targetVol - startVol) * t;

      if (t < 1) {
        this.fadeTimer = requestAnimationFrame(step);
      } else {
        this.fadeTimer = null;
      }
    };

    this.fadeTimer = requestAnimationFrame(step);
  }

  private fadeOut(durationMs: number): Promise<void> {
    return new Promise(resolve => {
      this.fadeTo(0, durationMs);
      setTimeout(resolve, durationMs + 50);
    });
  }

  destroy(): void {
    if (this.fadeTimer !== null) cancelAnimationFrame(this.fadeTimer);
    this.stopSource();
    this.ctx?.close();
    this.ctx = null;
    this.gainNode = null;
    this.bufferCache.clear();
  }
}

export const musicPlayer = new MusicPlayer();
