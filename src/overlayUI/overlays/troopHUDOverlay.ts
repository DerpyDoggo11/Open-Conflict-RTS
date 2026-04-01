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

    private _healthBar: HTMLElement;
    private _nameElement: HTMLElement;
    private _portraitElement: HTMLImageElement;
    private _actionsElement: HTMLElement;
    private _currentHealth: number;
    private _maxHealth: number;
    private _actions: TroopAction[];
    private _activeActionID: string | null = null;

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

        const info = document.createElement('div');
        info.className = 'troop-hud__info';

        const nameRow = document.createElement('div');
        nameRow.className = 'troop-hud__name-row';

        this._nameElement = document.createElement('span');
        this._nameElement.className = 'troop-hud__name';
        this._nameElement.textContent = options.name;
        nameRow.appendChild(this._nameElement);

        this._actionsElement = document.createElement('div');
        this._actionsElement.className = 'troop-hud__actions';
        nameRow.appendChild(this._actionsElement);

        info.appendChild(nameRow);

        const healthTrack = document.createElement('div');
        healthTrack.className = 'troop-hud__health-track';

        this._healthBar = document.createElement('div');
        this._healthBar.className = 'troop-hud__health-bar';
        this._healthBar.style.width = '100%';
        healthTrack.appendChild(this._healthBar);
        info.appendChild(healthTrack);

        this.element.appendChild(info);

        this._renderActions();
    }

    setHealth(current: number, max?: number): void {
        this._currentHealth = Math.max(0, current);
        if (max !== undefined) {
            this._maxHealth = max;
        }
        const pct = this._maxHealth > 0 ? (this._currentHealth / this._maxHealth) * 100 : 0;
        this._healthBar.style.width = `${pct}%`;
    
        const g = Math.round((pct / 100) * 180);
        const r = Math.round(((100 - pct) / 100) * 200);
        this._healthBar.style.backgroundColor = `rgb(${r + 55}, ${g}, 40)`;
    }
    
    setName(name: string): void {
        this._nameElement.textContent = name;
    }

    setPortrait(path: string): void {
        this._portraitElement.src = path;
    }

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

    show(): void { 
        this.element.classList.add('troop-hud--visible'); 
    }
    hide(): void { 
        this.element.classList.remove('troop-hud--visible'); 
    }
    destroy(): void { 
        this.element.remove(); 
    }

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
            btn.title = action.label;

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
                if (!action.disabled) { 
                    action.onClick();
                }
            });

            this._actionsElement.appendChild(btn);
        }
    }
}