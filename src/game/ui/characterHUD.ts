import * as PIXI from 'pixi.js';

export type HUDAction = 'move' | 'attack';

interface HUDButton {
  container: PIXI.Container;
  action: HUDAction;
}

export class CharacterHUD {
  private container: PIXI.Container;
  private buttons: HUDButton[] = [];
  private onAction: (action: HUDAction) => void;
  private activeAction: HUDAction | null = null;

  constructor(
    viewport: PIXI.Container,
    onAction: (action: HUDAction) => void,
  ) {
    this.onAction = onAction;
    this.container = new PIXI.Container();
    this.container.visible = false;
    viewport.addChild(this.container);
    this.buildButtons();
  }

  private async buildButtons(): Promise<void> {
    const actions: { action: HUDAction; icon: string }[] = [
      { action: 'move',   icon: '/assets/icons/move.png'   },
      { action: 'attack', icon: '/assets/icons/attack.png' },
    ];

    const buttonSize = 32;
    const padding = 8;
    const totalWidth = actions.length * (buttonSize + padding) - padding;

    for (let i = 0; i < actions.length; i++) {
      const { action, icon } = actions[i];
      const btn = new PIXI.Container();
      btn.x = i * (buttonSize + padding) - totalWidth / 2;

      const bg = new PIXI.Graphics();
      this.drawBg(bg, false);
      btn.addChild(bg);

      const texture = await PIXI.Assets.load(icon);
      const sprite = new PIXI.Sprite(texture);
      sprite.width = buttonSize;
      sprite.height = buttonSize;
      btn.addChild(sprite);

      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      btn.on('pointerover', () => this.drawBg(bg, true));
      btn.on('pointerout',  () => this.drawBg(bg, this.activeAction === action));
      btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this.setActiveAction(action);
        this.onAction(action);
      });

      this.container.addChild(btn);
      this.buttons.push({ container: btn, action });
    }
  }

  private drawBg(bg: PIXI.Graphics, highlighted: boolean): void {
    const buttonSize = 32;
    bg.clear();
    bg.roundRect(-4, -4, buttonSize + 8, buttonSize + 8, 8);
    bg.fill({ color: highlighted ? 0x374a6a : 0x2e3f5c, alpha: 0.9 });
    bg.stroke({ color: 0xffffff, alpha: highlighted ? 0.4 : 0.2, width: 1 });
  }

  private setActiveAction(action: HUDAction | null): void {
    this.activeAction = action;
    this.buttons.forEach((btn, i) => {
      const bg = btn.container.getChildAt(0) as PIXI.Graphics;
      this.drawBg(bg, btn.action === action);
    });
  }

  attachTo(sprite: PIXI.Sprite): void {
    this.container.x = sprite.x;
    this.container.y = sprite.y - sprite.height * sprite.scale.y - 20;
    this.container.visible = true;
    this.setActiveAction(null);
  }

  hide(): void {
    this.container.visible = false;
    this.setActiveAction(null);
  }

  update(sprite: PIXI.Sprite): void {
    if (!this.container.visible) return;
    this.container.x = sprite.x;
    this.container.y = sprite.y - sprite.height * sprite.scale.y - 20;
  }
}