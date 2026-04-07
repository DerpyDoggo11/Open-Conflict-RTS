import * as PIXI from 'pixi.js';

export interface ProjectileOptions {
  texturePath: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  speed?: number;
  scale?: number;
  onImpact?: () => void;
}

interface ActiveProjectile {
  sprite: PIXI.Sprite;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  speed: number;
  onImpact?: () => void;
}

const textureCache = new Map<string, PIXI.Texture>();

export class ProjectileManager {
  private container: PIXI.Container;
  private app: PIXI.Application;
  private active: ActiveProjectile[] = [];
  private tickerFn: ((ticker: PIXI.Ticker) => void) | null = null;

  constructor(app: PIXI.Application, container: PIXI.Container) {
    this.app = app;
    this.container = container;
  }

  async spawn(options: ProjectileOptions): Promise<void> {
    const {
      texturePath,
      startX, startY,
      endX, endY,
      speed = 800,
      scale = 5,
      onImpact,
    } = options;

    let texture = textureCache.get(texturePath);
    if (!texture) {
      try {
        texture = await PIXI.Assets.load(texturePath);
        textureCache.set(texturePath, texture!);
      } catch {
        console.warn(`[ProjectileManager] Failed to load texture: ${texturePath}`);
        onImpact?.();
        return;
      }
    }

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(startX, startY);
    sprite.scale.set(scale);
    sprite.zIndex = 100000;

    const angle = Math.atan2(endY - startY, endX - startX);
    sprite.rotation = angle;

    this.container.addChild(sprite);

    const projectile: ActiveProjectile = {
      sprite,
      startX, startY,
      endX, endY,
      speed,
      onImpact,
    };

    this.active.push(projectile);
    this._ensureTicker();
  }

  spawnBurst(
    texturePath: string,
    startX: number, startY: number,
    endX: number, endY: number,
    shots: number,
    shotDelay: number,
    speed?: number,
    scale?: number,
    onShotImpact?: (shotIndex: number) => void,
  ): void {
    for (let i = 0; i < shots; i++) {
      setTimeout(() => {
        this.spawn({
          texturePath,
          startX, startY,
          endX, endY,
          speed,
          scale,
          onImpact: () => onShotImpact?.(i),
        });
      }, i * shotDelay);
    }
  }

  private _ensureTicker(): void {
    if (this.tickerFn) return;

    let lastTime = performance.now();

    this.tickerFn = (_ticker: PIXI.Ticker) => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;

      for (let i = this.active.length - 1; i >= 0; i--) {
        const p = this.active[i];
        const dx = p.endX - p.sprite.x;
        const dy = p.endY - p.sprite.y;
        const dist = Math.hypot(dx, dy);
        const step = (p.speed * dt) / 1000;

        if (dist <= step) {
          p.sprite.destroy();
          p.onImpact?.();
          this.active.splice(i, 1);
        } else {
          const ratio = step / dist;
          p.sprite.x += dx * ratio;
          p.sprite.y += dy * ratio;
        }
      }

      if (this.active.length === 0 && this.tickerFn) {
        this.app.ticker.remove(this.tickerFn);
        this.tickerFn = null;
      }
    };

    this.app.ticker.add(this.tickerFn);
  }

  destroy(): void {
    for (const p of this.active) {
      p.sprite.destroy();
    }
    this.active.length = 0;
    if (this.tickerFn) {
      this.app.ticker.remove(this.tickerFn);
      this.tickerFn = null;
    }
  }
}