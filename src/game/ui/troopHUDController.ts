import * as PIXI from 'pixi.js';
import { TroopHUD } from '../../overlayUI/overlays/troopHUDOverlay';
import { clearSelection, clearArrow } from '../entities/selectionUtils';
import { colyseusClient } from '../network/colyseusClient';
import type { CharacterMovement } from '../entities/entityMovement';
import type { TiledMap } from '../types/tilemapTypes';
import { CompositeTilemap } from '@pixi/tilemap';

export type ActionMode = 'idle' | 'move' | 'attack';

export class TroopHUDController {
  private hud: TroopHUD | null = null;
  private selected: CharacterMovement | null = null;
  private mode: ActionMode = 'idle';

  constructor(
    private app: PIXI.Application,
    private viewport: PIXI.Container,
    private mapData: TiledMap,
    private tilesetTextures: Map<number, PIXI.Texture>,
    private objectsTilemap: CompositeTilemap,
  ) {}

  mount(): void {
    this.viewport.eventMode = 'static';
    this.viewport.on('pointerup', () => {
      if (this.mode === 'idle') this.deselect();
    });
  }

  selectTroop(character: CharacterMovement): void {
    if (this.selected === character) return;

    this.deselect();
    this.selected = character;
    this.mode = 'idle';

    const isOwned = character.ownerId === colyseusClient.sessionId;

    this.hud = new TroopHUD({
      portraitPath: character.portraitPath,
      name: character.troopType,
      maxHealth: character.maxHealth,
      actions: [
        {
          id: 'move',
          label: 'Move',
          iconPath: '/assets/ui/icons/move.png',
          disabled: !isOwned,
          onClick: () => this._toggleMove(),
        },
        {
          id: 'attack',
          label: 'Primary',
          iconPath: '/assets/ui/icons/attack.png',
          disabled: !isOwned,
          onClick: () => this._toggleAttack(),
        },
      ],
    });

    this.hud.setHealth(character.health, character.maxHealth);
    document.getElementById('app')!.appendChild(this.hud.element);
    requestAnimationFrame(() => this.hud?.show());

    character.onHealthChange((hp) => {
      this.hud?.setHealth(hp, character.maxHealth);
    });
  }

  deselect(): void {
    this._exitMode();
    this.selected?.close();
    this.hud?.hide();
    setTimeout(() => { this.hud?.destroy(); this.hud = null; }, 160);
    this.selected = null;
  }

  private _toggleMove(): void {
    if (!this.selected) return;
    if (this.mode === 'move') {
      this._exitMode();
      return;
    }
    this._exitMode();
    this.mode = 'move';
    this.hud?.setActiveAction('move');

    const originalMoveTo = this.selected.moveTo.bind(this.selected);
    this.selected.moveTo = (tx: number, ty: number) => {
      originalMoveTo(tx, ty);
      this._exitMode();
    };

    this.selected.openMove();
  }

  private _toggleAttack(): void {
    if (!this.selected) return;
    if (this.mode === 'attack') {
      this._exitMode();
      return;
    }
    this._exitMode();
    this.mode = 'attack';
    this.hud?.setActiveAction('attack');
    this.selected.openAttack();
  }

  private _exitMode(): void {
    clearSelection();
    clearArrow();
    this.mode = 'idle';
    this.hud?.setActiveAction(null);
  }
}