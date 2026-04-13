

export interface GameOverOptions {
  isVictory: boolean;
  mainMenuUrl: string;
  redirectDelay?: number;
  winImagePath?: string;
  deathImagePath?: string;
}

export class GameOverOverlay {
  public readonly element: HTMLElement;
  private _redirectTimer: ReturnType<typeof setTimeout> | null = null;
  private _tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: GameOverOptions) {
    const {
      isVictory,
      mainMenuUrl,
      redirectDelay = 8000,
      winImagePath = '/assets/ui/win.png',
      deathImagePath = '/assets/ui/death.png',
    } = options;

    this.element = document.createElement('div');
    this.element.className = 'game-over-overlay';

    const panel = document.createElement('div');
    panel.className = 'game-over-overlay__panel';
    this.element.appendChild(panel);

    const img = document.createElement('img');
    img.className = 'game-over-overlay__image';
    img.src = isVictory ? winImagePath : deathImagePath;
    img.alt = isVictory ? 'Victory' : 'Defeat';
    panel.appendChild(img);

    const title = document.createElement('h2');
    title.className = 'game-over-overlay__title';
    title.textContent = isVictory ? 'VICTORY' : 'DEFEAT';
    if (isVictory) title.classList.add('game-over-overlay__title--victory');
    else title.classList.add('game-over-overlay__title--defeat');
    panel.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'game-over-overlay__subtitle sublabel';
    subtitle.textContent = isVictory
      ? 'The enemy general has been eliminated.'
      : 'Your general has fallen.';
    panel.appendChild(subtitle);

    const btn = document.createElement('button');
    btn.className = 'game-over-overlay__btn';
    btn.textContent = 'Return to Main Menu';
    btn.addEventListener('click', () => {
      this._cleanup();
      window.location.href = mainMenuUrl;
    });
    panel.appendChild(btn);

    const countdown = document.createElement('span');
    countdown.className = 'game-over-overlay__countdown sublabel';
    panel.appendChild(countdown);

    if (redirectDelay > 0) {
      let remaining = Math.ceil(redirectDelay / 1000);
      countdown.textContent = `Returning in ${remaining}s\u2026`;

      this._tickInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          this._cleanup();
          window.location.href = mainMenuUrl;
        } else {
          countdown.textContent = `Returning in ${remaining}s\u2026`;
        }
      }, 1000);

      this._redirectTimer = setTimeout(() => {
        this._cleanup();
        window.location.href = mainMenuUrl;
      }, redirectDelay);
    }

    requestAnimationFrame(() => {
      this.element.classList.add('game-over-overlay--open');
    });
  }

  mount(parent?: HTMLElement): void {
    (parent ?? document.getElementById('app')!).appendChild(this.element);
  }

  private _cleanup(): void {
    if (this._redirectTimer) { clearTimeout(this._redirectTimer); this._redirectTimer = null; }
    if (this._tickInterval) { clearInterval(this._tickInterval); this._tickInterval = null; }
  }

  destroy(): void {
    this._cleanup();
    this.element.remove();
  }
}