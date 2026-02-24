
import type { IMenu, UIHandler } from '../UIHandler';
import { el } from '../dom';

export class gameMenu implements IMenu {
  private container!: HTMLElement;
  private paused = false;

  private hudMetal!:     HTMLElement;
  private hudSupply!:    HTMLElement;
  private pauseBtn!:     HTMLButtonElement;
  private pauseOverlay!: HTMLElement;

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.togglePause();
  };

  constructor(private ui: UIHandler) {}

  mount(container: HTMLElement): void {
    this.container = container;

    const root = el('div', { className: 'absolute inset-0 pointer-events-none' },
      this.buildHUD(),
      this.buildPauseOverlay(),
    );

    container.appendChild(root);
  }

  onShow(): void {
    window.addEventListener('keydown', this.onKeyDown);
    this.setPaused(false);
  }

  onHide(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.setPaused(false);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private buildHUD(): HTMLElement {
    this.hudMetal  = el('span', { textContent: '0' });
    this.hudSupply = el('span', { textContent: '0' });

    this.pauseBtn = el('button', {
      className: 'text-sm bg-bg-panel/80 hover:bg-bg-panel text-dim hover:text-white px-3.5 py-1.5 rounded-full transition-colors cursor-pointer pointer-events-auto',
      textContent: '⏸ Pause',
    });
    this.pauseBtn.addEventListener('click', () => this.togglePause());

    return el('div', {
      className: 'pointer-events-auto flex justify-between items-center px-4 py-2.5 bg-gradient-to-b from-nav/90 to-transparent',
    },
      el('div', { className: 'flex gap-5' },
        el('span', { className: 'text-base font-semibold bg-nav/70 px-3 py-1 rounded-full' },
          '⚙️ ', this.hudMetal,
        ),
        el('span', { className: 'text-base font-semibold bg-nav/70 px-3 py-1 rounded-full' },
          '🌾 ', this.hudSupply,
        ),
      ),
      this.pauseBtn,
    );
  }

  private buildPauseOverlay(): HTMLElement {
    const resumeBtn = el('button', {
      className: 'w-full bg-accent hover:bg-accent-h text-white py-2.5 rounded-full text-base cursor-pointer transition-colors shadow-md active:scale-95',
      textContent: 'Resume',
    });
    resumeBtn.addEventListener('click', () => this.togglePause());

    const settingsBtn = el('button', {
      className: 'w-full bg-bg-panel hover:bg-bg-outer text-dim hover:text-white py-2 rounded-full text-sm cursor-pointer transition-colors',
      textContent: 'Settings',
    });
    settingsBtn.addEventListener('click', () => {
      console.log('Open in-game settings');
    });

    const mainMenuBtn = el('button', {
      className: 'w-full bg-bg-panel hover:bg-bg-outer text-dim hover:text-white py-2 rounded-full text-sm cursor-pointer transition-colors',
      textContent: 'Main Menu',
    });
    mainMenuBtn.addEventListener('click', () => {
      this.setPaused(false);
      this.ui.show('main-menu');
    });

    this.pauseOverlay = el('div', {
      className: 'hidden absolute inset-0 flex items-center justify-center bg-nav/60 backdrop-blur-sm pointer-events-auto',
    },
      el('div', { className: 'bg-bg-card rounded-xl px-10 py-9 flex flex-col items-center gap-4 shadow-2xl min-w-64' },
        el('h2', { className: 'text-3xl font-semibold tracking-wide mb-2', textContent: 'Paused' }),
        el('div', { className: 'flex flex-col gap-2.5 w-full' },
          resumeBtn,
          settingsBtn,
          mainMenuBtn,
        ),
      ),
    );

    return this.pauseOverlay;
  }

  togglePause(): void {
    this.setPaused(!this.paused);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.pauseOverlay.classList.toggle('hidden', !paused);
    this.pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
    window.dispatchEvent(new CustomEvent('game:pause', { detail: { paused } }));
  }

  updateResources(metal: number, supply: number): void {
    this.hudMetal.textContent  = String(metal);
    this.hudSupply.textContent = String(supply);
  }
}