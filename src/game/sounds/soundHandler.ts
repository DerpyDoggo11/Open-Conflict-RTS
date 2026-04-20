import * as PIXI from 'pixi.js';

export interface SoundDef {
  path: string;
  volume?: number;
  positional?: boolean;
  maxDistance?: number;
  loop?: boolean;
}

interface ActiveSound {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  def: SoundDef;
  worldX?: number;
  worldY?: number;
}

export class SoundManager {
  private static ctx: AudioContext | null = null;
  private static app: PIXI.Application;
  private static viewport: PIXI.Container;

  private static defs: Map<string, SoundDef> = new Map();
  private static buffers: Map<string, AudioBuffer> = new Map();
  private static activeSounds: Set<ActiveSound> = new Set();

  private static masterGain: GainNode;
  private static tickBound = false;


  static async init(app: PIXI.Application, viewport: PIXI.Container): Promise<void> {
    SoundManager.app = app;
    SoundManager.viewport = viewport;

    SoundManager.ctx = new AudioContext();
    SoundManager.masterGain = SoundManager.ctx.createGain();
    SoundManager.masterGain.connect(SoundManager.ctx.destination);

    const resume = () => {
      SoundManager.ctx?.resume();
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);

    if (!SoundManager.tickBound) {
      SoundManager.tickBound = true;
      app.ticker.add(() => SoundManager.updatePositional());
    }
  }

  static async register(name: string, def: SoundDef): Promise<void> {
    SoundManager.defs.set(name, def);
    await SoundManager.loadBuffer(def.path);
  }

  static async registerAll(sounds: Record<string, SoundDef>): Promise<void> {
    await Promise.all(
      Object.entries(sounds).map(([name, def]) => SoundManager.register(name, def))
    );
  }

  private static async loadBuffer(path: string): Promise<AudioBuffer | null> {
    if (SoundManager.buffers.has(path)) return SoundManager.buffers.get(path)!;
    if (!SoundManager.ctx) return null;

    try {
      const resp = await fetch(path);
      const arrayBuf = await resp.arrayBuffer();
      const audioBuf = await SoundManager.ctx.decodeAudioData(arrayBuf);
      SoundManager.buffers.set(path, audioBuf);
      return audioBuf;
    } catch (e) {
      console.warn(`failed to load ${path}:`, e);
      return null;
    }
  }

  static play(
    name: string,
    worldX?: number,
    worldY?: number,
  ): ActiveSound | null {
    const ctx = SoundManager.ctx;
    if (!ctx || ctx.state !== 'running') return null;

    const def = SoundManager.defs.get(name);
    if (!def) {
      console.warn(`unknown sound: "${name}"`);
      return null;
    }

    const buffer = SoundManager.buffers.get(def.path);
    if (!buffer) return null;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = def.loop ?? false;

    const gainNode = ctx.createGain();
    gainNode.gain.value = def.volume ?? 1;
    source.connect(gainNode);
    gainNode.connect(SoundManager.masterGain);

    const active: ActiveSound = { source, gainNode, def, worldX, worldY };

    if (def.positional && worldX !== undefined && worldY !== undefined) {
      gainNode.gain.value = SoundManager.calcVolume(def, worldX, worldY);
      SoundManager.activeSounds.add(active);
    }

    source.onended = () => {
      SoundManager.activeSounds.delete(active);
    };

    source.start();
    return active;
  }

  static stop(handle: ActiveSound | null): void {
    if (!handle) return;
    try { handle.source.stop(); } catch { }
    SoundManager.activeSounds.delete(handle);
  }

  static setMasterVolume(v: number): void {
    if (SoundManager.masterGain) {
      SoundManager.masterGain.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  private static updatePositional(): void {
    for (const active of SoundManager.activeSounds) {
      if (active.worldX === undefined || active.worldY === undefined) continue;
      const vol = SoundManager.calcVolume(active.def, active.worldX, active.worldY);
      active.gainNode.gain.value = vol;
    }
  }

  private static calcVolume(def: SoundDef, worldX: number, worldY: number): number {
    const vp = SoundManager.viewport;
    const app = SoundManager.app;
    const scale = vp.scale.x || 1;

    const camX = (app.screen.width / 2 - vp.position.x) / scale;
    const camY = (app.screen.height / 2 - vp.position.y) / scale;

    const dx = worldX - camX;
    const dy = worldY - camY;
    const dist = Math.hypot(dx, dy);

    const maxDist = def.maxDistance ?? 1500;
    const baseVol = def.volume ?? 1;

    if (dist >= maxDist) return 0;

    const factor = 1 - dist / maxDist;
    return baseVol * factor * factor;
  }
}