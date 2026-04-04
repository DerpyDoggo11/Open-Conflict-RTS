import * as PIXI from 'pixi.js';
import { TroopHUD } from '../../overlayUI/overlays/troopHUDOverlay';
import { clearSelection, clearArrow } from '../entities/selectionUtils';
import { colyseusClient } from '../network/colyseusClient';
import type { CharacterMovement } from '../entities/entityMovement';
import type { TiledMap } from '../types/tilemapTypes';
import { CompositeTilemap } from '@pixi/tilemap';
import actionDefs from '../data/actions.json';
import troopDefs from '../data/troops.json';

type ActionType = 'move' | 'attack';

interface ActionDef {
  label: string;
  iconPath: string;
  type: ActionType;
  damage?: number;
}

export type ActionMode = 'idle' | 'move' | 'attack';

export class TroopHUDController {
  private hud: TroopHUD | null = null;
  private selected: CharacterMovement | null = null;
  private mode: ActionMode = 'idle';
  private _pendingDamage: number = 0;
  private _activeAttackActionId: string | null = null;
  private _justSelected = false;

  constructor(
    private app: PIXI.Application,
    private viewport: PIXI.Container,
    private mapData: TiledMap,
    private tilesetTextures: Map<number, PIXI.Texture>,
    private objectsTilemap: PIXI.Container,
  ) {}

  mount(): void {
    this.viewport.eventMode = 'static';
    this.viewport.on('pointerup', () => {
      if (this._justSelected) {
        this._justSelected = false;
        return;
      }
      if (this.mode === 'idle') this.deselect();
    });
  }

  selectTroop(character: CharacterMovement): void {
    if (this.selected === character) return;
    this._justSelected = true;

    this.deselect();
    this.selected = character;
    this.mode = 'idle';

    const isOwned = character.ownerId === colyseusClient.sessionId;
    const def = troopDefs[character.troopType as keyof typeof troopDefs];

    const actions = !isOwned ? [] : (def.actions as string[]).map(actionId => {
      const actionDef = actionDefs[actionId as keyof typeof actionDefs] as ActionDef;
      return {
        id: actionId,
        label: actionDef.label,
        iconPath: actionDef.iconPath,
        disabled: false,
        onClick: () => {
          if (actionDef.type === 'move') {
            this._toggleMove();
          } else if (actionDef.type === 'attack') {
            this._toggleAttack(actionId, actionDef.damage ?? 0);
          }
        },
      };
    });

    this.hud = new TroopHUD({
      portraitPath: character.portraitPath,
      name: character.troopType,
      maxHealth: character.maxHealth,
      actions,
    });
    
    document.getElementById('app')!.appendChild(this.hud.element);
    requestAnimationFrame(() => {
        this.hud?.show();
        this.hud?.setHealth(character.health, character.maxHealth);
    });

    character.onHealthChange((hp) => {
      this.hud?.setHealth(hp, character.maxHealth);
    });
  }

  deselect(): void {
    if (!this.selected) return;
    this._exitMode();
    const prev = this.selected;
    this.selected = null;
    prev.close();
    this.hud?.hide();
    setTimeout(() => { this.hud?.destroy(); this.hud = null; }, 160);
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

  private _toggleAttack(actionId: string, damage: number): void {
    if (!this.selected) return;

    if (this.mode === 'attack' && this._activeAttackActionId === actionId) {
      this._exitMode();
      return;
    }

    this._exitMode();
    this.mode = 'attack';
    this._pendingDamage = damage;
    this._activeAttackActionId = actionId;
    this.hud?.setActiveAction(actionId);

    this.selected.openAttack();
  }

  private _exitMode(): void {
    clearSelection();
    clearArrow();
    this.mode = 'idle';
    this._activeAttackActionId = null;
    this._pendingDamage = 0;
    this.hud?.setActiveAction(null);
  }
}