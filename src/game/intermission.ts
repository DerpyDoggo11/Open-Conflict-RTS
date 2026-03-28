import * as PIXI from 'pixi.js';
import { type TiledMap } from './types/tilemapTypes';
import { isTileInWalkableBounds, tileToScreen } from './tilemap/tilemapUtils';
import { spawnCharacter, type TroopType } from './entities/entityUtils';
import { CompositeTilemap } from '@pixi/tilemap';
import { TimerBanner } from '../overlayUI/components/timerBannerWidget';
import { ReadyWidget } from '../overlayUI/components/readyWidget';
import { IntermissionTroopSelectorOverlay } from '../overlayUI/overlays/intermissionTroopSelectorOverlay';
import troopDefs from './data/troops.json';
import { colyseusClient } from './network/colyseusClient';
import type { CharacterMovement } from './entities/entityMovement';

const SPAWN_GID = 5;
export const troopRegistry = new Map<string, CharacterMovement>();

const troopDefsArray = Object.entries(troopDefs).map(([key, def]) => ({
    type: key,
    ...(def as any),
}));

export class Intermission {
    private spawnZoneSprites: PIXI.Sprite[] = [];
    private spawnZoneContainer: PIXI.Container;
    private placedCount: number = 0;
    private readonly maxTroops = 4;
    private credits: number = 100;

    private overlay!: HTMLElement;
    private timer!: TimerBanner;
    private readyWidget!: ReadyWidget;
    private intermissionSelector!: IntermissionTroopSelectorOverlay;

    private pendingTile: {
        tileX: number;
        tileY: number
    }  | null = null;
    private onComplete: () => void;

    constructor(
        private app: PIXI.Application,
        private viewport: PIXI.Container,
        private mapData: TiledMap,
        private tilesetTextures: Map<number, PIXI.Texture>,
        private characterContainer: PIXI.Container,
        private hudContainer: PIXI.Container,
        private objectsTilemap: CompositeTilemap,
        private spawnZone: {
            x: number;
            y: number;
            w: number;
            h: number;
        },
        onComplete: () => void,
    ) {
        this.onComplete = onComplete;
        this.spawnZoneContainer = new PIXI.Container();
        viewport.addChild(this.spawnZoneContainer);

        this.spawnSelectionZone();
        this._buildOverlay();
        this._buildIntermissionSelectorOverlay();
        this._bindServerEvents();
    }

    private _buildOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.className = 'overlay';
        document.getElementById('app')!.appendChild(this.overlay);

        this.timer = new TimerBanner({
            durationSeconds: 60,
            label: 'Intermission',
            onComplete: () => this.onComplete(),
        });
        this.overlay.appendChild(this.timer.element);

        this.readyWidget = new ReadyWidget({
            totalPlayers: 2,
            onReady: (isReady) => {
                console.log('Local player ready: ', isReady);
            },
        });
        this.overlay.appendChild(this.readyWidget.element);
    }

    private _buildIntermissionSelectorOverlay(): void {
        const troopOptions = troopDefsArray.map(t => ({
            type: t.type as TroopType,
            label: t.name ?? t.type,
            cost: t.cost ?? 0,
            iconPath: t.iconPath ?? undefined,
        }));

        this.intermissionSelector = new IntermissionTroopSelectorOverlay({
            troops: troopOptions,
            credits: this.credits,
            onSelect: async (type) => {
                if (!this.pendingTile) return;
                const { tileX, tileY } = this.pendingTile;
                this.pendingTile = null;

                const troopDef = troopDefsArray.find(t => t.type === type);
                if (troopDef?.cost) {
                    this.credits -= troopDef.cost;
                    this.intermissionSelector.setCredits(this.credits);
                }

                await this._spawnTroop(type as TroopType, tileX, tileY);
            },
            onCancel: () => {
                this.pendingTile = null;
            },
        });
        document.getElementById('app')!.appendChild(this.intermissionSelector.element);
    }

    private _bindServerEvents(): void {
        colyseusClient.onTick(({ timeRemaining, intermissionDuration }) => {
            this.timer.syncFromServer(timeRemaining, intermissionDuration);
        });

        colyseusClient.onTroopSpawn(async (msg) => {
            if (msg.ownerId === colyseusClient.sessionId) return;

            await spawnCharacter(
                msg.type as TroopType,
                msg.tileX,
                msg.tileY,
                this.mapData,
                this.characterContainer,
                this.hudContainer,
                this.app,
                this.viewport,
                this.objectsTilemap,
                this.tilesetTextures,
            );
        });
    }

    private spawnSelectionZone(): void {
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

    private onSpawnTileClick(tileX: number, tileY: number): void {
        if (this.placedCount >= this.maxTroops) return;
        this.pendingTile = { tileX, tileY };
        this.intermissionSelector.open();
    }

    private async _spawnTroop(type: TroopType, tileX: number, tileY: number): Promise<void> {
        const character = await spawnCharacter(
            type, tileX, tileY,
            this.mapData, this.characterContainer, this.hudContainer,
            this.app, this.viewport, this.objectsTilemap, this.tilesetTextures,
        );

        const id = crypto.randomUUID();
        const troopDef = troopDefsArray.find(t => t.type === type);
        colyseusClient.spawnTroop(id, type, tileX, tileY, troopDef?.health ?? 100);

        this.placedCount++;
        const remaining = document.getElementById('troops-remaining');
        if (remaining) {
            remaining.textContent = `${this.maxTroops - this.placedCount} remaining`;
        }
    }

    private complete(): void {
        for (const s of this.spawnZoneSprites) s.destroy();
        this.spawnZoneSprites.length = 0;
        this.spawnZoneContainer.destroy();

        this.overlay.remove();
        this.intermissionSelector.element.remove();

        this.onComplete();
    }

}