import * as PIXI from 'pixi.js';
import { type TiledMap } from './types/tilemapTypes';
import { revealAllEnemies, setIntermissionComplete, spawnCharacter, onGameOver, type TroopType } from './entities/entityUtils';
import { TimerBanner } from '../overlayUI/components/timerBannerWidget';
import { ReadyWidget } from '../overlayUI/components/readyWidget';
import { IntermissionTroopSelectorOverlay } from '../overlayUI/overlays/intermissionTroopSelectorOverlay';
import {
  initSpawnZone,
  spawnSpawnZone,
  clearSpawnZone,
  getMapGids,
} from './entities/selectionUtils';
import troopDefs from './data/troops.json';
import { colyseusClient } from './network/colyseusClient';
import type { CharacterMovement } from './entities/entityMovement';
import { GameOverOverlay } from '../overlayUI/overlays/gameOverOverlay';
import { LOBBY_URL } from './network/serverConfig';

export const troopRegistry = new Map<string, CharacterMovement>();

const troopDefsArray = Object.entries(troopDefs).map(([key, def]) => ({
  type: key,
  ...(def as any),
}));

export class Intermission {
  private credits: number = 100;

  private overlay!: HTMLElement;
  private timer!: TimerBanner;
  private readyWidget!: ReadyWidget;
  private intermissionSelector!: IntermissionTroopSelectorOverlay;

  private _intermissionComplete = false;
  private _gameOverShown = false;

  private pendingTile: { tileX: number; tileY: number } | null = null;
  private onComplete: () => void;

  private panelOpen = false;
  private activeTab: 'chat' | 'teams' = 'chat';
  private unreadChat = false;

  private chatBox!: HTMLElement;
  private chatInner!: HTMLElement;
  private teamsInner!: HTMLElement;
  private chatIcon!: HTMLImageElement;
  private teamsBtn!: HTMLButtonElement;
  private chatBtn!: HTMLButtonElement;
  private controlsRow!: HTMLElement;
  private teamsList!: HTMLElement;

  constructor(
    private app: PIXI.Application,
    private viewport: PIXI.Container,
    private mapData: TiledMap,
    private tilesetTextures: Map<number, PIXI.Texture>,
    private hudContainer: PIXI.Container,
    private objectsContainer: PIXI.Container,
    private spawnZone: { x: number; y: number; w: number; h: number },
    private generalSpawn: { tileX: number; tileY: number },
    onComplete: () => void,
  ) {
    this.onComplete = onComplete;

    initSpawnZone(objectsContainer);

    this._buildOverlay();
    this._buildIntermissionSelectorOverlay();
    this._bindServerEvents();
    this._bindGameOverEvents();

    // Auto-spawn the general at the caller-specified position
    this._autoSpawnGeneral();

    this._refreshSpawnZone();
  }

  /* ── Auto-spawn general ── */

  private async _autoSpawnGeneral(): Promise<void> {
    const { tileX, tileY } = this.generalSpawn;

    await this._spawnTroop('general' as TroopType, tileX, tileY);
  }

  /* ── Game-over handling ── */

  private _bindGameOverEvents(): void {
    // Use the centralized game-over event from entityUtils.
    // This fires from ALL kill paths: local applyMultiHitDamage,
    // server troopDamage, server troopDied — whichever triggers first.
    onGameOver((isVictory: boolean) => {
      this._showGameOver(isVictory);
    });
  }

  private _showGameOver(isVictory: boolean): void {
    if (this._gameOverShown) return;
    this._gameOverShown = true;

    const overlay = new GameOverOverlay({
      isVictory,
      mainMenuUrl: LOBBY_URL,
      redirectDelay: 8000,
    });
    overlay.mount();
  }

  /* ── Spawn zone ── */

  private _refreshSpawnZone(): void {
    const gids = getMapGids();
    spawnSpawnZone(
      this.tilesetTextures,
      this.spawnZone,
      gids.spawnTile,
      this.mapData,
      (tileX, tileY) => this.onSpawnTileClick(tileX, tileY),
    );
  }

  private onSpawnTileClick(tileX: number, tileY: number): void {
    if (this.credits <= 0) return;
    this.pendingTile = { tileX, tileY };
    this.intermissionSelector.setCredits(this.credits);
    this.intermissionSelector.open();
  }

  private async _spawnTroop(type: TroopType, tileX: number, tileY: number): Promise<void> {
    const movement = await spawnCharacter(
      type, tileX, tileY,
      this.mapData, this.hudContainer,
      this.app, this.viewport, this.objectsContainer, this.tilesetTextures,
      true,
    );

    // Wire up local general death detection (health listener)
    if (type === 'general') {
      movement.onHealthChange((hp) => {
        if (hp <= 0) {
          this._showGameOver(false); // our general died → defeat
        }
      });
    }

    this._refreshSpawnZone();
  }

  private _buildIntermissionSelectorOverlay(): void {
    // Filter OUT the general — it is auto-spawned and cannot be manually selected
    const troopOptions = troopDefsArray
      .filter(t => t.type !== 'general')
      .map(t => ({
        type: t.type as TroopType,
        label: t.name ?? t.type,
        cost: t.cost ?? 0,
        iconPath: t.portraitPath ?? undefined,
      }));

    this.intermissionSelector = new IntermissionTroopSelectorOverlay({
      troops: troopOptions,
      credits: this.credits,
      onSelect: async (type) => {
        if (!this.pendingTile) return;

        const troopDef = troopDefsArray.find(t => t.type === type);
        const cost = troopDef?.cost ?? 0;

        // Can't afford this troop
        if (cost > this.credits) return;

        const { tileX, tileY } = this.pendingTile;
        this.pendingTile = null;

        this.credits -= cost;
        this.intermissionSelector.setCredits(this.credits);

        await this._spawnTroop(type as TroopType, tileX, tileY);
      },
      onCancel: () => {
        this.pendingTile = null;
      },
    });
    document.getElementById('app')!.appendChild(this.intermissionSelector.element);
  }

  private _buildOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    document.getElementById('app')!.appendChild(this.overlay);

    this.timer = new TimerBanner({
      durationSeconds: 480,
      titleLabel: 'Intermission',
      onComplete: () => this.complete(),
    });
    this.overlay.appendChild(this.timer.element);

    this.readyWidget = new ReadyWidget({
      totalPlayers: 2,
      onReady: (isReady) => {
        colyseusClient.sendReady(isReady);
      },
    });
    this.overlay.appendChild(this.readyWidget.element);

    this._buildChatUI();
  }

  private _openPanel(tab: 'chat' | 'teams'): void {
    this.panelOpen = true;
    this.activeTab = tab;
    this.chatBox.classList.add('chat-box--open');
    this.controlsRow.classList.add('chat-controls--open');
    this._syncPanelContent();
    if (tab === 'chat') {
      this.unreadChat = false;
      this.chatIcon.src = '/assets/ui/chatBubble.png';
    }
  }

  private _closePanel(): void {
    this.panelOpen = false;
    this.chatBox.classList.remove('chat-box--open');
    this.controlsRow.classList.remove('chat-controls--open');
  }

  private _switchTab(tab: 'chat' | 'teams'): void {
    this.activeTab = tab;
    this._syncPanelContent();
    if (tab === 'chat') {
      this.unreadChat = false;
      this.chatIcon.src = '/assets/ui/chatBubble.png';
    }
  }

  private _syncPanelContent(): void {
    const showChat = this.activeTab === 'chat';
    this.chatInner.style.display  = showChat ? 'flex' : 'none';
    this.teamsInner.style.display = showChat ? 'none' : 'flex';
    this.chatBtn.classList.toggle('chat-controls__btn--active', showChat);
    this.teamsBtn.classList.toggle('chat-controls__btn--active', !showChat);
  }

  private _buildChatUI(): void {
    this.controlsRow = document.createElement('div');
    this.controlsRow.className = 'chat-controls';
    this.overlay.appendChild(this.controlsRow);

    this.teamsBtn = document.createElement('button');
    this.teamsBtn.className = 'chat-controls__btn';
    const teamsIcon = document.createElement('img');
    teamsIcon.className = 'chat-controls__icon';
    teamsIcon.src = '/assets/ui/teamsIcon.png';
    teamsIcon.alt = 'Teams';
    this.teamsBtn.appendChild(teamsIcon);
    this.controlsRow.appendChild(this.teamsBtn);

    this.chatBtn = document.createElement('button');
    this.chatBtn.className = 'chat-controls__btn';
    this.chatIcon = document.createElement('img');
    this.chatIcon.className = 'chat-controls__icon';
    this.chatIcon.src = '/assets/ui/chatBubble.png';
    this.chatIcon.alt = 'Chat';
    this.chatBtn.appendChild(this.chatIcon);
    this.controlsRow.appendChild(this.chatBtn);

    this.chatBox = document.createElement('div');
    this.chatBox.className = 'chat-box';
    this.overlay.appendChild(this.chatBox);

    this.chatInner = document.createElement('div');
    this.chatInner.className = 'chat-box__inner';
    this.chatBox.appendChild(this.chatInner);

    const messages = document.createElement('div');
    messages.className = 'chat-box__messages';
    this.chatInner.appendChild(messages);

    const inputRow = document.createElement('div');
    inputRow.className = 'chat-box__input-row';
    this.chatInner.appendChild(inputRow);

    const input = document.createElement('input');
    input.className = 'chat-box__input';
    input.type = 'text';
    input.placeholder = 'Type a message...';
    input.maxLength = 200;
    inputRow.appendChild(input);

    const sendBtn = document.createElement('button');
    sendBtn.className = 'chat-box__send';
    sendBtn.textContent = 'Send';
    inputRow.appendChild(sendBtn);

    this.teamsInner = document.createElement('div');
    this.teamsInner.className = 'chat-box__inner chat-box__teams';
    this.teamsInner.style.display = 'none';
    this.chatBox.appendChild(this.teamsInner);

    this.teamsList = document.createElement('div');
    this.teamsList.className = 'teams-list';
    this.teamsInner.appendChild(this.teamsList);

    this.chatBtn.addEventListener('click', () => {
      if (!this.panelOpen) {
        this._openPanel('chat');
        input.focus();
      } else if (this.activeTab === 'chat') {
        this._closePanel();
      } else {
        this._switchTab('chat');
        input.focus();
      }
    });

    this.teamsBtn.addEventListener('click', () => {
      if (!this.panelOpen) {
        this._openPanel('teams');
      } else if (this.activeTab === 'teams') {
        this._closePanel();
      } else {
        this._switchTab('teams');
      }
    });

    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      colyseusClient.sendChat(text);
      input.value = '';
      input.focus();
    };

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });

    colyseusClient.onChat((msg) => {
      const element = document.createElement('div');
      element.className =
        msg.playerId === 'system' ? 'chat-msg chat-msg--system' : 'chat-msg';

      if (msg.playerId === 'system') {
        element.textContent = msg.text;
      } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'chat-msg__name';
        nameSpan.textContent = `${msg.name}:`;
        element.appendChild(nameSpan);

        if (msg.playerId === colyseusClient.sessionId) {
          const youSpan = document.createElement('i');
          youSpan.textContent = ' (You)';
          nameSpan.appendChild(youSpan);
        }

        element.appendChild(document.createTextNode(' ' + msg.text));
      }

      messages.appendChild(element);
      messages.scrollTop = messages.scrollHeight;

      const chatVisible = this.panelOpen && this.activeTab === 'chat';
      if (!chatVisible && msg.playerId !== colyseusClient.sessionId) {
        this.unreadChat = true;
        this.chatIcon.src = '/assets/ui/chatBubblePing.png';
      }
    });
  }

  public updateTeamsList(
    teams: { teamName: string; players: { id: string; name: string }[] }[]
  ): void {
    this.teamsList.innerHTML = '';

    for (const team of teams) {
      const group = document.createElement('div');
      group.className = 'team-group';

      const header = document.createElement('div');
      header.className = 'team-group__header';
      header.textContent = team.teamName;
      if (team.teamName === 'Red')  header.style.color = '#ff4d4d';
      if (team.teamName === 'Blue') header.style.color = '#4d79ff';
      group.appendChild(header);

      for (const player of team.players) {
        const row = document.createElement('div');
        row.className = 'team-player';

        const name = document.createElement('span');
        name.className = 'team-player__name';
        name.textContent = player.name;
        row.appendChild(name);

        if (player.id === colyseusClient.sessionId) {
          const you = document.createElement('i');
          you.className = 'team-player__you';
          you.textContent = ' (You)';
          row.appendChild(you);
        }

        group.appendChild(row);
      }

      this.teamsList.appendChild(group);
    }
  }

  private _bindServerEvents(): void {
    colyseusClient.onTick(({ timeRemaining, intermissionDuration, gameDuration }) => {
      const inIntermission =
        !this._intermissionComplete &&
        timeRemaining > gameDuration - intermissionDuration;

      if (inIntermission) {
        const intermissionRemaining =
          timeRemaining - (gameDuration - intermissionDuration);
        this.timer.setTitleLabel('Intermission');
        this.timer.syncFromServer(intermissionRemaining, intermissionDuration);
      } else if (!this._intermissionComplete) {
        this.complete();
      } else {
        this.timer.setTitleLabel('Game');
        this.timer.syncFromServer(timeRemaining, gameDuration - intermissionDuration);
      }
    });

    colyseusClient.onReadyStateChange((readyCount, totalCount) => {
      this.readyWidget.setReadyCount(readyCount, totalCount);
    });

    colyseusClient.onGameStart(() => {
      this.complete();
    });
  }

  private complete(): void {
    if (this._intermissionComplete) return;
    this._intermissionComplete = true;

    try {
      setIntermissionComplete();
      revealAllEnemies(colyseusClient.sessionId);

      clearSpawnZone();
      this.readyWidget.element.remove();
      this.intermissionSelector.element.remove();
      this.timer.setTitleLabel('Game');
    } catch (e) {
      console.error('Intermission error:', e);
    }

    this.onComplete();
  }
}