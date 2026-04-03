export interface TroopAction {
    id: string;
    label: string;
    iconPath: string;
    onClick: () => void;
    disabled?: boolean;
}

export interface TroopHUDOptions {
    portraitPath: string;
    name: string;
    maxHealth: number;
    actions: TroopAction[];
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
    private _currentFrame: number = 62;
    private readonly TOTAL_HEALTH_FRAMES = 63;

    constructor(options: TroopHUDOptions) {
        this._currentHealth = options.maxHealth;
        this._maxHealth = options.maxHealth;
        this._actions = options.actions;

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
        const frame = Math.round(pct * (this.TOTAL_HEALTH_FRAMES - 1));
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
        this._renderActions();
    }

    setActionDisabled(actionID: string, disabled: boolean): void {
        const action = this._actions.find(a => a.id === actionID);
        if (!action) return;
        action.disabled = disabled;
        this._renderActions();
    }

    show(): void  { this.element.classList.add('troop-hud--visible'); }
    hide(): void  { this.element.classList.remove('troop-hud--visible'); }
    destroy(): void { this.element.remove(); }

    private _renderActions(): void {
        this._actionsElement.innerHTML = '';

        for (const action of this._actions) {
            const btn = document.createElement('button');
            btn.className = [
                'troop-hud__action-btn',
                action.disabled ? 'troop-hud__action-btn--disabled' : '',
                this._activeActionID === action.id ? 'troop-hud__action-btn--active'   : '',
            ].filter(Boolean).join(' ');
            btn.disabled = !!action.disabled;

            const label = document.createElement('span');
            label.className = 'troop-hud__action-label';
            label.textContent = action.label;

            const icon = document.createElement('img');
            icon.className = 'troop-hud__action-icon';
            icon.src = action.iconPath;
            icon.alt = action.label;

            btn.appendChild(label);
            btn.appendChild(icon);
            btn.addEventListener('click', () => {
                if (!action.disabled) action.onClick();
            });

            this._actionsElement.appendChild(btn);
        }
    }
}