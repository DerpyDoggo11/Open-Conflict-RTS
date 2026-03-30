const TOTAL_BANNER_FRAMES = 11;
const FRAME_INTERVAL_SECONDS = 6;

export interface TimerBannerOptions {
    durationSeconds: number;
    titleLabel?: string;
    onComplete?: () => void;
}

export class TimerBanner {
    public readonly element: HTMLElement;

    private readonly _labelElement: HTMLElement;
    private readonly _bannerSprite: HTMLElement;
    private readonly _duration: number;
    private readonly _onComplete?: () => void;

    private _titleLabel: string;
    private _remaining: number;
    private _ticker: ReturnType<typeof setInterval> | null = null;
    private _started = false;
    private _currentSpriteFrame = 0;
    private _spriteFrameWidth = 0;

    constructor(options: TimerBannerOptions) {
        const { durationSeconds, titleLabel = 'Intermission', onComplete} = options;

        this._duration = durationSeconds;
        this._remaining = durationSeconds;
        this._onComplete = onComplete;
        this._titleLabel = titleLabel;

        this.element = document.createElement('div');
        this.element.className = 'timer-banner';

        this._bannerSprite = document.createElement('div');
        this._bannerSprite.className = 'timer-banner__sprite';
        this.element.appendChild(this._bannerSprite);

        this._labelElement = document.createElement('span');
        this._labelElement.className = 'timer-banner__label';
        this._updateLabel();
        this.element.appendChild(this._labelElement);

        this._initSprite();
    }

    private _initSprite(): void {
        const style = getComputedStyle(document.documentElement);
        const spritePath = style.getPropertyValue('--timer-banner-path').trim();
        const frameWidth = parseFloat(style.getPropertyValue('--timer-banner-width').trim()) || 0;

        this._bannerSprite.style.backgroundImage = spritePath;
        this._bannerSprite.style.backgroundRepeat = 'no-repeat';

        const match = spritePath.match(/url\(['"]?(.+?)['"]?\)/);
        if (!match) return;
 
        const img = new Image();
        img.onload = () => {
            this._spriteFrameWidth = frameWidth || img.naturalWidth / TOTAL_BANNER_FRAMES;
            const totalWidth = this._spriteFrameWidth * TOTAL_BANNER_FRAMES;
            this._bannerSprite.style.width = `${this._spriteFrameWidth}px`;
            this._bannerSprite.style.height = `${img.naturalHeight}px`;
            this._bannerSprite.style.backgroundSize = `${totalWidth}px 100%`;
            this._setSpriteFrame(0);
        };
        img.src = match[1];
    }

    private _setSpriteFrame(frame: number): void {
        this._currentSpriteFrame = frame;
        this._bannerSprite.style.backgroundPositionX = `-${frame * this._spriteFrameWidth}px`;
    }

    setTitleLabel(text: string): void {
        this._titleLabel = text;
    }

    private _updateLabel(): void {
        this._labelElement.textContent = `${this._titleLabel}: ${this._remaining}s`;
    }

    private _stop(): void {
        if (this._ticker !== null) {
            clearInterval(this._ticker);
            this._ticker = null;
        }
    }

    destroy(): void {
        this._stop();
        this.element.remove();
    }

    syncFromServer(timeRemaining: number, totalDuration: number): void {
        this._remaining = Math.ceil(timeRemaining);
        this._updateLabel();

        const elapsed = totalDuration - timeRemaining;
        const targetFrame = Math.min(
            Math.floor(elapsed / FRAME_INTERVAL_SECONDS),
            TOTAL_BANNER_FRAMES - 1,
        );

        if (targetFrame !== this._currentSpriteFrame) {
            this._setSpriteFrame(targetFrame);
        }

        if (this._remaining <= 0) {
            this._stop();
            this._onComplete?.();
        }
    }

}