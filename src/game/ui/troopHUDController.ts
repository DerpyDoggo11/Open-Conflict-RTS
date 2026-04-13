import * as PIXI from 'pixi.js';
import { TroopHUD } from '../../overlayUI/overlays/troopHUDOverlay';
import { clearSelection, clearArrow } from '../entities/selectionUtils';
import { colyseusClient } from '../network/colyseusClient';
import type { CharacterMovement } from '../entities/entityMovement';
import type { TiledMap } from '../types/tilemapTypes';
import actionDefs from '../data/actions.json';
import troopDefs from '../data/troops.json';

type ActionType = 'move' | 'attack' | 'repair';

interface ActionDef {
  label: string;
  iconPath: string;
  type: ActionType;
  damage?: number;
  shots?: number;
  shotDelay?: number;
  cooldown?: number;
  projectilePath?: string;
}

export type ActionMode = 'idle' | 'move' | 'attack';

export class TroopHUDController {
  private hud: TroopHUD | null = null;
  private selected: CharacterMovement | null = null;
  private mode: ActionMode = 'idle';
  private _pendingDamage: number = 0;
  private _pendingShots: number = 1;
  private _activeAttackActionId: string | null = null;
  private _justSelected = false;
  private _justActed = false;

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
      // Suppress deselect right after selecting a troop
      if (this._justSelected) {
        this._justSelected = false;
        return;
      }

      // Suppress deselect right after an action (move/attack) was executed.
      // The tile click that triggered the action also bubbles here as pointerup;
      // without this guard the HUD would be destroyed and cooldowns lost.
      if (this._justActed) {
        this._justActed = false;
        return;
      }

      if (this.mode !== 'idle') {
        this._exitMode();
        return;
      }

      this.deselect();
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
        cooldown: actionDef.cooldown ?? 0,
        disabled: false,
        onClick: () => {
          if (this.hud?.isOnCooldown(actionId)) return;

          if (actionDef.type === 'move') {
            this._toggleMove(actionId);
          } else if (actionDef.type === 'attack') {
            this._toggleAttack(actionId, actionDef.damage ?? 20, actionDef.shots ?? 1);
          }
        },
      };
    });

    this.hud = new TroopHUD({
      portraitPath: character.portraitPath,
      name: character.troopType,
      maxHealth: character.maxHealth,
      actions,
      cooldownSpritePath: "/assets/ui/iconCooldown.png",
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

  private _toggleMove(actionId: string = 'move'): void {
    if (!this.selected) return;

    if (this.mode === 'move') {
      this._exitMode();
      return;
    }

    this._exitMode();
    this.mode = 'move';
    this.hud?.setActiveAction(actionId);

    const originalMoveTo = this.selected.moveTo.bind(this.selected);
    const self = this;
    this.selected.moveTo = (tx: number, ty: number) => {
      originalMoveTo(tx, ty);
      self._justActed = true;
      self._exitMode();
      self.hud?.startCooldown(actionId);
    };

    this.selected.openMove();
  }
    
  private _toggleAttack(actionId: string, damage: number, shots: number): void {
    if (!this.selected) return;

    if (this.mode === 'attack' && this._activeAttackActionId === actionId) {
      this._exitMode();
      return;
    }

    this._exitMode();
    this.mode = 'attack';
    this._pendingDamage = damage;
    this._pendingShots = shots;
    this._activeAttackActionId = actionId;
    this.hud?.setActiveAction(actionId);

    const capturedActionId = actionId;
    const hudRef = this.hud;
    const self = this;

    this.selected.openAttack(
      (attackerId: string, targetTileX: number, targetTileY: number, dmg: number, s: number) => {
        self._justActed = true;
        self._exitMode();
        hudRef?.startCooldown(capturedActionId);
      },
      damage,
      shots,
    );
  }

  private _exitMode(): void {
    clearSelection();
    clearArrow();
    this.mode = 'idle';
    this._activeAttackActionId = null;
    this._pendingDamage = 0;
    this._pendingShots = 1;
    this.hud?.setActiveAction(null);
  }
}