import type { IMenu, UIHandler } from '../UIHandler';
import { el } from '../dom';

interface ServerData {
  id: number;
  name: string;
  current: number;
  max: number;
}

const SERVERS: ServerData[] = [
  { id: 1, name: 'Server 1', current: 1, max: 2 },
  { id: 2, name: 'Server 2', current: 2, max: 2 },
];

const TABS = ['play', 'loadouts', 'settings'] as const;
type Tab = typeof TABS[number];

export class menu implements IMenu {
  private container!: HTMLElement;
  private navBtns: Map<Tab, HTMLButtonElement> = new Map();
  private panes:   Map<Tab, HTMLElement>       = new Map();

  constructor(private ui: UIHandler) {}

  mount(container: HTMLElement): void {
    this.container = container;
    container.classList.add('pointer-events-auto');

    const root = el('div', { className: 'flex flex-col h-full bg-bg-outer' },
      this.buildNav(),
      this.buildPlayPane(),
      this.buildLoadoutsPane(),
      this.buildSettingsPane(),
    );

    container.appendChild(root);
    this.showTab('play');
  }

  onShow(): void {}
  onHide(): void {}

  private buildNav(): HTMLElement {
    const nav = el('nav', { className: 'flex justify-center gap-2 bg-nav shadow-lg shrink-0' });

    for (const tab of TABS) {
      const btn = el('button', {
        className: 'border-b-2 border-transparent text-white/60 hover:text-white text-lg px-4 py-3 bg-transparent cursor-pointer transition-colors capitalize',
        textContent: tab,
      });
      btn.addEventListener('click', () => this.showTab(tab));
      this.navBtns.set(tab, btn);
      nav.appendChild(btn);
    }

    return nav;
  }

  private showTab(tab: Tab): void {
    this.navBtns.forEach((btn, key) => {
      const active = key === tab;
      btn.classList.toggle('border-accent', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('border-transparent', !active);
      btn.classList.toggle('text-white/60', !active);
    });
    this.panes.forEach((pane, key) => {
      pane.classList.toggle('hidden', key !== tab);
      pane.classList.toggle('flex', key === tab);
    });
  }

  private buildPlayPane(): HTMLElement {
    const pane = el('div', {
      className: 'hidden flex-col gap-4 p-7 w-full max-w-2xl mx-auto',
    },
      ...SERVERS.map(s => this.buildServerCard(s)),
    );
    this.panes.set('play', pane);
    return pane;
  }

  private buildServerCard(server: ServerData): HTMLElement {
    const isFull = server.current >= server.max;

    const playerCount = el('span', {
      className: `text-sm font-semibold ${isFull ? 'text-red' : 'text-green'}`,
      textContent: `${server.current}/${server.max} players`,
    });

    const joinBtn = el('button', {
      className: 'bg-accent hover:bg-accent-h text-white px-7 py-2.5 rounded-full cursor-pointer transition-colors shadow-md active:scale-95',
      textContent: 'Join',
    });
    joinBtn.addEventListener('click', () => {
      console.log(`Joining server ${server.id}`);
      this.ui.show('in-game');
    });

    return el('div', { className: 'bg-bg-card rounded-lg p-5 flex items-center justify-between shadow-md' },
      el('div', {},
        el('h3', { className: 'text-lg font-medium mb-1', textContent: server.name }),
        playerCount,
      ),
      joinBtn,
    );
  }

  private buildLoadoutsPane(): HTMLElement {
    const pane = el('div', {
      className: 'hidden flex-col gap-4 p-7 w-full max-w-2xl mx-auto',
    },
      this.buildUnitGrid('Available Units:', 7, true),
      this.buildUnitGrid('Selected Units', 4, false),
    );
    this.panes.set('loadouts', pane);
    return pane;
  }

  private buildUnitGrid(title: string, count: number, selectable: boolean): HTMLElement {
    const slots = Array.from({ length: count }, () => {
      const slot = el('div', {
        className: 'w-16 h-16 bg-slate-300 rounded-md border-2 border-transparent transition-all duration-150',
      });

      if (selectable) {
        slot.classList.add('cursor-pointer', 'hover:-translate-y-0.5', 'hover:shadow-lg');
        slot.addEventListener('click', () => {
          const selected = slot.dataset.selected !== undefined;
          if (selected) {
            delete slot.dataset.selected;
            slot.classList.remove('border-accent');
          } else {
            slot.dataset.selected = '';
            slot.classList.add('border-accent');
          }
        });
      } else {
        slot.classList.add('border-dashed', 'border-white/20');
      }

      return slot;
    });

    return el('div', { className: 'bg-bg-card rounded-lg p-5 shadow-md' },
      el('h3', { className: 'text-sm font-medium text-dim mb-4', textContent: title }),
      el('div', { className: 'flex flex-wrap gap-3' }, ...slots),
    );
  }

  private buildSettingsPane(): HTMLElement {
    const pane = el('div', {
      className: 'hidden flex-col gap-4 p-7 w-full max-w-2xl mx-auto',
    },
      el('div', { className: 'bg-bg-card rounded-lg p-6 shadow-md flex flex-col gap-5' },
        this.buildVolumeRow(),
        this.buildQualityRow(),
      ),
    );
    this.panes.set('settings', pane);
    return pane;
  }

  private buildVolumeRow(): HTMLElement {
    const slider = el('input', {
      className: 'w-48 h-2.5 rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-h [&::-webkit-slider-thumb]:shadow-md',
      type: 'range',
      min: '0',
      max: '100',
      value: '65',
      style: { background: 'linear-gradient(to right, #3d9e7a 65%, #2d3f5a 65%)' },
    });

    slider.addEventListener('input', () => {
      slider.style.background =
        `linear-gradient(to right, #3d9e7a ${slider.value}%, #2d3f5a ${slider.value}%)`;
    });

    return el('div', { className: 'flex items-center gap-5' },
      el('label', { className: 'w-40 text-base shrink-0', textContent: 'Volume:' }),
      slider,
    );
  }

  private buildQualityRow(): HTMLElement {
    const qualities = ['low', 'medium', 'high'] as const;
    const btns = new Map<string, HTMLButtonElement>();

    const setActive = (quality: string) => {
      btns.forEach((btn, key) => {
        const active = key === quality;
        btn.classList.toggle('bg-accent', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('bg-bg-panel', !active);
        btn.classList.toggle('text-dim', !active);
      });
    };

    const btnGroup = el('div', { className: 'flex gap-2' },
      ...qualities.map(q => {
        const btn = el('button', {
          className: 'px-4 py-1.5 rounded-full text-sm cursor-pointer transition-colors bg-bg-panel text-dim hover:text-white',
          textContent: q.charAt(0).toUpperCase() + q.slice(1),
        });
        btn.addEventListener('click', () => setActive(q));
        btns.set(q, btn);
        return btn;
      }),
    );

    setActive('high');

    return el('div', { className: 'flex items-center gap-5' },
      el('label', { className: 'w-40 text-base shrink-0', textContent: 'Graphics Quality:' }),
      btnGroup,
    );
  }
}