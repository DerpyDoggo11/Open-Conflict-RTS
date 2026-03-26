export interface animatedButtonOptions {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    width?: string;
    className?: string;
    frameInterval?: number;
    clickFrameInterval?: number;
}

export class animatedButton {
    public readonly element: HTMLButtonElement;
    private _frame = 0;
    private readonly _totalFrames = 3;
    private _animTimer: ReturnType<typeof setInterval> | null = null;
    private _frameWidth = 0;
    private _frameInterval: number;
    private _clickFrameInterval: number;

    constructor(options: animatedButtonOptions) {
        const {
            label,
            onClick,
            disabled = false,
            width,
            className = '',
            frameInterval = 40,
            clickFrameInterval = 80,
        } = options;

        this._clickFrameInterval = clickFrameInterval ?? frameInterval;
        this._frameInterval = frameInterval;
        this.element = document.createElement('button');
        this.element.className = ['animated-button', className]
            .filter(Boolean)
            .join(' ');
        this.element.textContent = label;
        this.element.disabled = disabled;

        if (width) this.element.style.width = width;
        if (onClick) this.element.addEventListener('click', onClick);

        this.element.addEventListener('mouseenter', () => this._animateTo(1));
        this.element.addEventListener('mouseleave', () => this._animateTo(0));
        this.element.addEventListener('mousedown', () => this._playClickSequence());

        this._checkSpriteLoaded();
    }

    setDisabled(disabled: boolean): void {
        this.element.disabled = disabled;
        this.element.classList.toggle('animated-button--disabled', disabled);
        if (disabled) {
        this._stopAnim();
        this._setFrame(0);
        }
    }

    setLabel(label: string): void {
        this.element.textContent = label;
    }

    private _animateTo(target: number, interval = this._frameInterval): Promise<void> {
        this._stopAnim();
        return new Promise(resolve => {
            if (this._frame === target) {
                resolve();
                return;
            }
            this._animTimer = setInterval(() => {
                const next = this._frame + (this._frame < target ? 1: -1);
                this._setFrame(next);
                if (this._frame === target) {
                    this._stopAnim();
                    resolve();
                }
            }, interval);
        });
    }

    private async _playClickSequence(): Promise<void> {
        if (this.element.disabled) {
            return;
        }
        await this._animateTo(2, this._clickFrameInterval);
        await this._animateTo(1, this._clickFrameInterval);
    }

    private _stopAnim(): void {
        if (this._animTimer !== null) {
            clearInterval(this._animTimer);
            this._animTimer = null;
        }
    }

    private _setFrame(index: number): void {
        this._frame = index;
        this.element.style.backgroundPositionX = `-${index * this._frameWidth}px`;
    }

    private _checkSpriteLoaded(): void {
        const style = getComputedStyle(document.documentElement);
        const spritePath = style.getPropertyValue('--animated-button-path').trim();
        const widthValue = style.getPropertyValue('--animated-button-width').trim();
        this._frameWidth = parseFloat(widthValue) || 0;

        const match = spritePath.match(/url\(['"]?(.+?)['"]?\)/);
        if (!match) return;

        const img = new Image();
        img.onload = () => {
            if (!this._frameWidth) {
                this._frameWidth = img.naturalWidth / this._totalFrames;
            }
            this.element.classList.add('animated-button--loaded');
            this._setFrame(0);
        };
        img.src = match[1];
    }
}