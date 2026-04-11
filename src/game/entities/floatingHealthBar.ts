import * as PIXI from 'pixi.js';

const BAR_WIDTH = 48;
const BAR_HEIGHT = 8;
const BAR_OFFSET_Y = -6;
const TOTAL_FRAMES = 63;

let sharedTextures: PIXI.Texture[] | null = null;
let loadingPromise: Promise<void> | null = null;

async function ensureTextures(spritePath: string): Promise<PIXI.Texture[]> {
  if (sharedTextures) return sharedTextures;

  if (!loadingPromise) {
    loadingPromise = (async () => {
      const sheet = await PIXI.Assets.load(spritePath);
      const src = sheet.source;
      if (src.width === 0 || src.height === 0) {
        if (src.resource instanceof HTMLImageElement) {
          await src.resource.decode();
          src.update();
        }
      }
      const frameW = Math.floor(src.width / TOTAL_FRAMES);
      const frameH = src.height;
      const textures: PIXI.Texture[] = [];
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        textures.push(new PIXI.Texture({
          source: src,
          frame: new PIXI.Rectangle(i * frameW, 0, frameW, frameH),
        }));
      }
      sharedTextures = textures;
    })();
  }

  await loadingPromise;
  return sharedTextures!;
}

export class FloatingHealthBar {
  private container: PIXI.Container;
  private healthSprite: PIXI.Sprite;
  private previewGraphics: PIXI.Graphics;

  private _health: number;
  private _maxHealth: number;
  private _visible = false;
  private _previewHealth: number | null = null;
  private _flashTimer: ReturnType<typeof setInterval> | null = null;
  private _flashOn = true;
  private _textures: PIXI.Texture[] = [];

  private sprite: PIXI.Sprite;
  private tickerFn: ((ticker: PIXI.Ticker) => void) | null = null;
  private app: PIXI.Application;

  constructor(
    app: PIXI.Application,
    parentContainer: PIXI.Container,
    sprite: PIXI.Sprite,
    maxHealth: number,
    spritePath: string,
  ) {
    this.app = app;
    this.sprite = sprite;
    this._health = maxHealth;
    this._maxHealth = maxHealth;

    this.container = new PIXI.Container();
    this.container.zIndex = 999999;
    this.container.visible = false;

    this.healthSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.healthSprite.anchor.set(0.5, 0.5);
    this.healthSprite.width = BAR_WIDTH;
    this.healthSprite.height = BAR_HEIGHT;
    this.container.addChild(this.healthSprite);

    this.previewGraphics = new PIXI.Graphics();
    this.container.addChild(this.previewGraphics);

    parentContainer.addChild(this.container);

    this.tickerFn = () => this.updatePosition();
    app.ticker.add(this.tickerFn);

    ensureTextures(spritePath).then(textures => {
      this._textures = textures;
      this.updateFrame();
    });
  }

  private updatePosition(): void {
    if (!this.sprite || this.sprite.destroyed) return;
    this.container.position.set(
      this.sprite.x,
      this.sprite.y - this.sprite.height + BAR_OFFSET_Y,
    );
  }

  private getFrame(): number {
    const pct = this._maxHealth > 0 ? this._health / this._maxHealth : 0;
    return Math.round((1 - pct) * (TOTAL_FRAMES - 1));
  }

  private updateFrame(): void {
    if (this._textures.length === 0) return;
    const frame = this.getFrame();
    this.healthSprite.texture = this._textures[Math.min(frame, this._textures.length - 1)];
  }

  private redrawPreview(): void {
    this.previewGraphics.clear();
    if (this._previewHealth === null || this._textures.length === 0) return;

    const currentPct = this._health / this._maxHealth;
    const previewPct = Math.max(0, this._previewHealth / this._maxHealth);

    if (currentPct > previewPct && this._flashOn) {
      const barLeft = -BAR_WIDTH / 2;
      const previewX = barLeft + previewPct * BAR_WIDTH;
      const chunkW = (currentPct - previewPct) * BAR_WIDTH;
      this.previewGraphics.rect(previewX, -BAR_HEIGHT / 2, chunkW, BAR_HEIGHT);
      this.previewGraphics.fill({ color: 0xff4444, alpha: 0.75 });
    }
  }

  setHealth(hp: number): void {
    this._health = Math.max(0, hp);
    const damaged = this._health < this._maxHealth;

    if (damaged && !this._visible) {
      this._visible = true;
      this.container.visible = true;
    }
    if (!damaged) {
      this._visible = false;
      this.container.visible = false;
    }

    this.updateFrame();
  }

  showDamagePreview(estimatedDamage: number): void {
    this._previewHealth = Math.max(0, this._health - estimatedDamage);
    if (!this.container.visible) this.container.visible = true;

    if (!this._flashTimer) {
      this._flashOn = true;
      this._flashTimer = setInterval(() => {
        this._flashOn = !this._flashOn;
        this.redrawPreview();
      }, 300);
    }
    this.redrawPreview();
  }

  clearDamagePreview(): void {
    this._previewHealth = null;
    if (this._flashTimer) {
      clearInterval(this._flashTimer);
      this._flashTimer = null;
    }
    this._flashOn = true;
    if (this._health >= this._maxHealth) this.container.visible = false;
    this.redrawPreview();
  }

  destroy(): void {
    if (this._flashTimer) { clearInterval(this._flashTimer); this._flashTimer = null; }
    if (this.tickerFn) { this.app.ticker.remove(this.tickerFn); this.tickerFn = null; }
    this.container.destroy({ children: true });
  }
}