import { animatedButton } from "./animatedButton";

export interface ReadyWidgetOptions {
    totalPlayers: number;
    onReady?: (isReady: boolean) => void; 
}

export class ReadyWidget {
    public readonly element: HTMLElement;

    private readonly _button: animatedButton;
    private readonly _countElement: HTMLElement;
    private readonly _onReady?: (isReady: boolean) => void;

    private _totalPlayers: number;
    private _isReady = false;
    private _readyCount = 0;

    constructor(options: ReadyWidgetOptions) {
        const { totalPlayers, onReady } = options;
        this._totalPlayers = totalPlayers;
        this._onReady = onReady;

        this.element = document.createElement('div');
        this.element.className = 'ready-widget';

        this._countElement = document.createElement('span');
        this._countElement.className = 'ready-count';
        this._updateCount();

        this._button = new animatedButton({
            label: 'Ready',
            onClick: () => this._toggle(),
        });

        this.element.appendChild(this._countElement);
        this.element.appendChild(this._button.element);
    }

    setReadyCount(ready: number, total: number): void {
        this._readyCount = ready;
        this._totalPlayers = total;
        this._updateCount();
    }

    private _toggle(): void {
        this._isReady = !this._isReady;
        this._readyCount += this._isReady ? 1 : -1;
        this._updateCount();
        this._onReady?.(this._isReady);
    }

    private _updateCount(): void {
        this._countElement.textContent = `${this._readyCount}/${this._totalPlayers}`;
    }
}