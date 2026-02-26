import * as PIXI from 'pixi.js';
import { type TiledMap } from './types/tilemapTypes';
import { tileToScreen, screenToTile, isTileInWalkableBounds } from './tilemap/tilemapUtils';
import { spawnCharacter, type TroopType } from './entities/entityUtils';
import { CompositeTilemap } from '@pixi/tilemap';
import { intermissionOverlay } from './ui/intermissionOverlay';
import troopDefs from './data/troops.json';

const SPAWN_GID = 5;
const INTERMISSION_DURATION_MS = 60_000;

export class Intermission {
  private spawnZoneSprites: PIXI.Sprite[] = [];
  private spawnZoneContainer: PIXI.Container;
  private selectedTroopType: TroopType | null = null;
  private placedCount: number = 0;
  private readonly maxTroops = 4;
  private ui: intermissionOverlay;
  private onComplete: () => void;

  constructor(
    private app: PIXI.Application,
    private viewport: PIXI.Container,
    private mapData: TiledMap,
    private tilesetTextures: Map<number, PIXI.Texture>,
    private characterContainer: PIXI.Container,
    private hudContainer: PIXI.Container,
    private objectsTilemap: CompositeTilemap,
    private spawnZone: { x: number; y: number; w: number; h: number },
    onComplete: () => void,
  ) {
    this.onComplete = onComplete;
    this.spawnZoneContainer = new PIXI.Container();
    viewport.addChild(this.spawnZoneContainer);

    this.spawnBlueZone();
    this.bindSpawnClick();
    this.updateTroopSelector(null);

    this.ui = new intermissionOverlay(INTERMISSION_DURATION_MS, () => this.complete());
  }

  private spawnBlueZone(): void {
    const texture = this.tilesetTextures.get(SPAWN_GID);
    if (!texture) return;

    for (let dx = 0; dx < this.spawnZone.w; dx++) {
      for (let dy = 0; dy < this.spawnZone.h; dy++) {
        const tileX = this.spawnZone.x + dx;
        const tileY = this.spawnZone.y + dy;
        if (!isTileInWalkableBounds(tileX, tileY, this.mapData)) continue;

        const screenPos = tileToScreen(tileX, tileY, this.mapData);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(screenPos.x, screenPos.y);
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';

        sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
        });
        sprite.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
          this.onSpawnTileClick(tileX, tileY);
        });

        this.spawnZoneContainer.addChild(sprite);
        this.spawnZoneSprites.push(sprite);
      }
    }
  }

  private bindSpawnClick(): void {
    document.querySelectorAll<HTMLElement>('[data-troop]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.troop as TroopType;
        this.selectedTroopType = type;
        this.updateTroopSelector(type);
      });
    });
  }

  private updateTroopSelector(active: TroopType | null): void {
    document.querySelectorAll<HTMLElement>('[data-troop]').forEach(btn => {
      btn.classList.toggle('ring-2', btn.dataset.troop === active);
      btn.classList.toggle('ring-accent-teal', btn.dataset.troop === active);
    });
  }

  private async onSpawnTileClick(tileX: number, tileY: number): Promise<void> {
    if (!this.selectedTroopType) return;
    if (this.placedCount >= this.maxTroops) return;

    await spawnCharacter(
      this.selectedTroopType, tileX, tileY,
      this.mapData, this.characterContainer, this.hudContainer,
      this.app, this.viewport, this.objectsTilemap, this.tilesetTextures,
    );

    this.placedCount++;
    document.getElementById('troops-remaining')!.textContent =
      `${this.maxTroops - this.placedCount} remaining`;
  }

  private complete(): void {
    for (const s of this.spawnZoneSprites) s.destroy();
    this.spawnZoneSprites.length = 0;
    this.spawnZoneContainer.destroy();
    document.getElementById('intermission-panel')!.classList.add('hidden');

    this.onComplete();
  }
}