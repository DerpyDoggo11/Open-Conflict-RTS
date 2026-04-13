/**
 * GameOverOverlay – shown when a general dies.
 * Uses the same background-image treatment as IntermissionTroopSelectorOverlay.
 */

export interface GameOverOptions {
  /** true = you won, false = you lost */
  isVictory: boolean;
  /** URL to redirect to (main menu) */
  mainMenuUrl: string;
  /** Delay in ms before auto-redirect (0 = no auto-redirect) */
  redirectDelay?: number;
  /** Path to the victory image */
  winImagePath?: string;
  /** Path to the defeat image */
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

    // Full-screen backdrop
    this.element = document.createElement('div');
    this.element.className = 'game-over-overlay';

    // Panel (same style as intermission-troop-selector__panel)
    const panel = document.createElement('div');
    panel.className = 'game-over-overlay__panel';
    this.element.appendChild(panel);

    // Result image
    const img = document.createElement('img');
    img.className = 'game-over-overlay__image';
    img.src = isVictory ? winImagePath : deathImagePath;
    img.alt = isVictory ? 'Victory' : 'Defeat';
    panel.appendChild(img);

    // Title
    const title = document.createElement('h2');
    title.className = 'game-over-overlay__title';
    title.textContent = isVictory ? 'VICTORY' : 'DEFEAT';
    if (isVictory) title.classList.add('game-over-overlay__title--victory');
    else title.classList.add('game-over-overlay__title--defeat');
    panel.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.className = 'game-over-overlay__subtitle sublabel';
    subtitle.textContent = isVictory
      ? 'The enemy general has been eliminated.'
      : 'Your general has fallen.';
    panel.appendChild(subtitle);

    // Button
    const btn = document.createElement('button');
    btn.className = 'game-over-overlay__btn';
    btn.textContent = 'Return to Main Menu';
    btn.addEventListener('click', () => {
      this._cleanup();
      window.location.href = mainMenuUrl;
    });
    panel.appendChild(btn);

    // Countdown label
    const countdown = document.createElement('span');
    countdown.className = 'game-over-overlay__countdown sublabel';
    panel.appendChild(countdown);

    // Auto-redirect countdown
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

    // Animate in on next frame
    requestAnimationFrame(() => {
      this.element.classList.add('game-over-overlay--open');
    });
  }

  /** Mount into the DOM */
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