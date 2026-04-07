export interface TroopAction {
    id: string;
    label: string;
    iconPath: string;
    onClick: () => void;
    disabled?: boolean;
    cooldown?: number;
}

export interface TroopHUDOptions {
    portraitPath: string;
    name: string;
    maxHealth: number;
    actions: TroopAction[];
    cooldownSpritePath: string;
}

export class TroopHUD {
    public readonly element: HTMLElement;

    private _healthBarSprite: HTMLElement;
    private _nameElement: HTMLElement;
    private _portraitElement: HTMLImageElement;
    private _actionsElement: HTMLElement;
    private _currentHealth: number;
    private _maxHealth: number;
    private _actions: TroopAction[];
    private _activeActionID: string | null = null;
    private _scaledFrameWidth: number = 0;
    private _currentFrame: number = 0;
    private readonly TOTAL_HEALTH_FRAMES = 63;

    private readonly COOLDOWN_FRAMES = 17;
    private _cooldownSpritePath: string;
    private _cooldownTimers: Map<string, number> = new Map();
    private _coolingDownActions: Set<string> = new Set();
    private _actionButtons: Map<string, HTMLButtonElement> = new Map();
    private _cooldownOverlays: Map<string, HTMLElement> = new Map();

    constructor(options: TroopHUDOptions) {
        this._currentHealth = options.maxHealth;
        this._maxHealth = options.maxHealth;
        this._actions = options.actions;
        this._cooldownSpritePath = options.cooldownSpritePath;

        this.element = document.createElement('div');
        this.element.className = 'troop-hud';

        const portrait = document.createElement('div');
        portrait.className = 'troop-hud__portrait';
        this._portraitElement = document.createElement('img');
        this._portraitElement.className = 'troop-hud__portrait-img';
        this._portraitElement.src = options.portraitPath;
        this._portraitElement.alt = options.name;
        portrait.appendChild(this._portraitElement);
        this.element.appendChild(portrait);

        const nameCell = document.createElement('div');
        nameCell.className = 'troop-hud__name-cell';
        this._nameElement = document.createElement('span');
        this._nameElement.className = 'troop-hud__name';
        this._nameElement.textContent = options.name;
        nameCell.appendChild(this._nameElement);
        this.element.appendChild(nameCell);

        this._actionsElement = document.createElement('div');
        this._actionsElement.className = 'troop-hud__actions';
        this.element.appendChild(this._actionsElement);

        const healthTrack = document.createElement('div');
        healthTrack.className = 'troop-hud__health-track';
        this._healthBarSprite = document.createElement('div');
        this._healthBarSprite.className = 'troop-hud__health-sprite';
        healthTrack.appendChild(this._healthBarSprite);
        this.element.appendChild(healthTrack);

        this._renderActions();
        this._initHealthSprite();
    }

    private _initHealthSprite(): void {
        const style = getComputedStyle(document.documentElement);
        const spritePath = style.getPropertyValue('--health-bar-path').trim();
        const match = spritePath.match(/url\(['"]?(.+?)['"]?\)/);
        if (!match) return;

        this._healthBarSprite.style.backgroundImage = spritePath;
        this._healthBarSprite.style.backgroundRepeat = 'no-repeat';

        const observer = new ResizeObserver(() => {
            const w = this._healthBarSprite.clientWidth;
            if (w === 0) return;
            this._scaledFrameWidth = w;
            this._healthBarSprite.style.backgroundSize =
                `${w * this.TOTAL_HEALTH_FRAMES}px 100%`;
            this._setHealthFrame(this._currentFrame);
        });
        observer.observe(this._healthBarSprite);
    }

    private _setHealthFrame(frame: number): void {
        this._currentFrame = frame;
        if (this._scaledFrameWidth === 0) return;
        this._healthBarSprite.style.backgroundPositionX =
            `-${frame * this._scaledFrameWidth}px`;
    }

    setHealth(current: number, max?: number): void {
        this._currentHealth = Math.max(0, current);
        if (max !== undefined) this._maxHealth = max;
        const pct = this._maxHealth > 0 ? this._currentHealth / this._maxHealth : 0;
        const frame = Math.round((1 - pct) * (this.TOTAL_HEALTH_FRAMES - 1));
        this._setHealthFrame(frame);
    }

    setName(name: string): void { this._nameElement.textContent = name; }
    setPortrait(path: string): void { this._portraitElement.src = path; }

    setActions(actions: TroopAction[]): void {
        this._actions = actions;
        this._activeActionID = null;
        this._renderActions();
    }

    setActiveAction(actionID: string | null): void {
        this._activeActionID = actionID;
        for (const [id, btn] of this._actionButtons) {
            btn.classList.toggle('troop-hud__action-btn--active', id === actionID);
        }
    }

    setActionDisabled(actionID: string, disabled: boolean): void {
        const action = this._actions.find(a => a.id === actionID);
        if (!action) return;
        action.disabled = disabled;
        this._renderActions();
    }

    startCooldown(actionId: string): void {
        const action = this._actions.find(a => a.id === actionId);
        if (!action || !action.cooldown || action.cooldown <= 0) return;

        this.cancelCooldown(actionId);

        this._coolingDownActions.add(actionId);

        const btn = this._actionButtons.get(actionId);
        if (btn) {
            btn.disabled = true;
            btn.classList.add('troop-hud__action-btn--disabled');
        }

        let overlay = this._cooldownOverlays.get(actionId);
        if (!overlay) return; 

        overlay.style.display = 'block';

        const totalDuration = action.cooldown;
        const frameDuration = totalDuration / this.COOLDOWN_FRAMES;
        let currentFrame = 0;
        const startTime = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const newFrame = Math.min(
                Math.floor(elapsed / frameDuration),
                this.COOLDOWN_FRAMES - 1
            );

            if (newFrame !== currentFrame) {
                currentFrame = newFrame;
                this._setCooldownFrame(overlay!, currentFrame);
            }

            if (currentFrame < this.COOLDOWN_FRAMES - 1) {
                const rafId = requestAnimationFrame(animate);
                this._cooldownTimers.set(actionId, rafId);
            } else {
                this._finishCooldown(actionId);
            }
        };

        this._setCooldownFrame(overlay, 0);
        const rafId = requestAnimationFrame(animate);
        this._cooldownTimers.set(actionId, rafId);
    }

    cancelCooldown(actionId: string): void {
        const rafId = this._cooldownTimers.get(actionId);
        if (rafId !== undefined) {
            cancelAnimationFrame(rafId);
            this._cooldownTimers.delete(actionId);
        }
        this._finishCooldown(actionId);
    }

    isOnCooldown(actionId: string): boolean {
        return this._coolingDownActions.has(actionId);
    }

    private _finishCooldown(actionId: string): void {
        this._coolingDownActions.delete(actionId);
        this._cooldownTimers.delete(actionId);

        const overlay = this._cooldownOverlays.get(actionId);
        if (overlay) {
            overlay.style.display = 'none';
        }

        const action = this._actions.find(a => a.id === actionId);
        const btn = this._actionButtons.get(actionId);
        if (btn && action && !action.disabled) {
            btn.disabled = false;
            btn.classList.remove('troop-hud__action-btn--disabled');
        }
    }

    private _setCooldownFrame(overlay: HTMLElement, frame: number): void {
        const frameWidth = overlay.clientWidth;
        if (frameWidth === 0) return;
        overlay.style.backgroundPositionX = `-${frame * frameWidth}px`;
    }
    
    show(): void  { this.element.classList.add('troop-hud--visible'); }
    hide(): void  { this.element.classList.remove('troop-hud--visible'); }

    destroy(): void {
        for (const [, rafId] of this._cooldownTimers) {
            cancelAnimationFrame(rafId);
        }
        this._cooldownTimers.clear();
        this._coolingDownActions.clear();
        this._actionButtons.clear();
        this._cooldownOverlays.clear();
        this.element.remove();
    }

    private _renderActions(): void {
        this._actionsElement.innerHTML = '';
        this._actionButtons.clear();
        this._cooldownOverlays.clear();

        const previouslyCooling = new Set(this._coolingDownActions);

        for (const action of this._actions) {
            const isCooling = previouslyCooling.has(action.id);

            const btn = document.createElement('button');
            btn.className = [
                'troop-hud__action-btn',
                (action.disabled || isCooling) ? 'troop-hud__action-btn--disabled' : '',
                this._activeActionID === action.id ? 'troop-hud__action-btn--active' : '',
            ].filter(Boolean).join(' ');
            btn.disabled = !!action.disabled || isCooling;

            const label = document.createElement('span');
            label.className = 'troop-hud__action-label';
            label.textContent = action.label;

            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'troop-hud__action-icon-wrapper';

            const icon = document.createElement('img');
            icon.className = 'troop-hud__action-icon';
            icon.src = action.iconPath;
            icon.alt = action.label;

            const cooldownOverlay = document.createElement('div');
            cooldownOverlay.className = 'troop-hud__cooldown-overlay';
            cooldownOverlay.style.backgroundImage = `url('${this._cooldownSpritePath}')`;
            cooldownOverlay.style.display = isCooling ? 'block' : 'none';

            iconWrapper.appendChild(icon);
            iconWrapper.appendChild(cooldownOverlay);

            btn.appendChild(label);
            btn.appendChild(iconWrapper);
            btn.addEventListener('click', () => {
                if (!action.disabled && !this._coolingDownActions.has(action.id)) {
                    action.onClick();
                }
            });

            this._actionsElement.appendChild(btn);
            this._actionButtons.set(action.id, btn);
            this._cooldownOverlays.set(action.id, cooldownOverlay);
        }
    }
}