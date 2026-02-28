import { initGame } from "../game/gameInit"
import { colyseusClient } from "../game/network/colyseusClient";
import { initMainMenuBackground } from './mainMenuBackground';

import '../style.css';

const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const contents = document.querySelectorAll<HTMLElement>('.tab-content');
const indicator = document.getElementById('tab-indicator') as HTMLElement;

function setActiveTab(tabName: string): void {
  tabs.forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('text-[#b0bdd0]', !active);
  });
  contents.forEach(c => c.classList.add('hidden'));
  const activeContent = document.getElementById('tab-' + tabName);
  if (activeContent) activeContent.classList.remove('hidden');
  moveIndicator(tabName);
}

function moveIndicator(tabName: string): void {
  const btn = document.querySelector<HTMLButtonElement>(`[data-tab="${tabName}"]`);
  if (!btn) return;
  const nav = btn.closest('nav') as HTMLElement;
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  indicator.style.left = (btnRect.left - navRect.left) + 'px';
  indicator.style.width = btnRect.width + 'px';
}

tabs.forEach(btn => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab!));
});

export async function startGame(): Promise<void> {
  const nav = document.querySelector('nav') as HTMLElement;
  const main = document.querySelector('main') as HTMLElement;
  const background = document.querySelector('bg-canvas') as HTMLElement;
  const app = document.getElementById('app') as HTMLElement;
  const waitingOverlay = document.getElementById('waiting-overlay') as HTMLElement;
  const waitingCount = document.getElementById('waiting-count') as HTMLElement;

  nav.classList.add('hidden');
  main.classList.add('hidden');
  app.classList.remove('hidden');

  colyseusClient.onPlayerCount((count, max) => {
    waitingCount.textContent = `${count} / ${max} players connected`;
    if (count >= max) {
      waitingOverlay.classList.add('hidden');
      background.classList.add('hidden');
    } else {
      waitingOverlay.classList.remove('hidden');
    }
  });

  
  waitingOverlay.classList.remove('hidden');
  waitingCount.textContent = `1 / 2 players connected`;

  await initGame();
}

(window as any).startGame = startGame;

export function updateVolume(slider: HTMLInputElement): void {
  const pct = slider.value + '%';
  slider.style.background = `linear-gradient(to right, #3a9e7e ${pct}, #2e3f5c ${pct})`;
}

(window as any).updateVolume = updateVolume;

function updateQualityButtons(quality: string): void {
  document.querySelectorAll<HTMLButtonElement>('.quality-btn').forEach(btn => {
    const active = btn.dataset.quality === quality;
    btn.classList.toggle('bg-accent-teal', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-bg-panel', !active);
    btn.classList.toggle('text-[#b0bdd0]', !active);
  });
}

document.getElementById('quality-btns')?.addEventListener('click', (e: MouseEvent) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.quality-btn');
  if (btn?.dataset.quality) updateQualityButtons(btn.dataset.quality);
});

const unitNames: string[] = [
  'General', 'Grunt', 'Machine\nGunner', 'Tank\nDestroyer',
  'Sniper', 'Medic', 'Engineer',
];

let dragSrc: HTMLElement | null = null;

function buildUnits(): void {
  const available = document.getElementById('available-units') as HTMLElement;
  unitNames.forEach((name, i) => {
    available.appendChild(createUnitCard(name, i));
  });

  const selected = document.getElementById('selected-units') as HTMLElement;
  for (let i = 0; i < 4; i++) {
    selected.appendChild(createEmptySlot());
  }

}

function createUnitCard(name: string, index: number): HTMLElement {
  const card = document.createElement('div');
  card.className ='unit-card bg-[#c8cdd8] rounded w-14 h-14 flex items-end justify-center pb-1 ' + 'text-[#374a6a] text-[9px] font-bold text-center leading-tight';
  card.draggable = true;
  card.dataset.unit = name;
  card.dataset.index = String(index);
  card.innerHTML = `<span>${name.replace('\n', '<br>')}</span>`;
  return card;
}

function createEmptySlot(): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'unit-slot bg-[#c8cdd8] rounded w-14 h-14';
  return slot;
}

export async function leaveGame(): Promise<void> {
  await colyseusClient.leave();
  const nav = document.querySelector('nav') as HTMLElement;
  const main = document.querySelector('main') as HTMLElement;
  const app = document.getElementById('app') as HTMLElement;
  nav.classList.remove('hidden');
  main.classList.remove('hidden');
  app.classList.add('hidden');
}
(window as any).leaveGame = leaveGame;

async function refreshServerCards(): Promise<void> {
  const rooms = await colyseusClient.getRooms();
  const cards = document.querySelectorAll<HTMLElement>('#tab-play .bg-bg-card');
  cards.forEach((card, i) => {
    const room = rooms[i];
    const countEl = card.querySelector('p:nth-child(2)') as HTMLElement;
    if (room) {
      const full = room.clients >= room.maxClients;
      countEl.textContent = `${room.clients}/${room.maxClients} players`;
      countEl.className = `text-sm font-medium ${full ? 'text-red-400' : 'text-green-400'}`;
    } else {
      countEl.textContent = '0/2 players';
      countEl.className = 'text-green-400 text-sm font-medium';
    }
  });
}


window.addEventListener('load', () => {
  setActiveTab('play');
  buildUnits();
  updateQualityButtons('high');
  refreshServerCards();
  initMainMenuBackground();
  setInterval(refreshServerCards, 3000);
});

window.addEventListener('resize', () => {
  const activeBtn = document.querySelector<HTMLButtonElement>('.tab-btn.text-white');
  if (activeBtn?.dataset.tab) moveIndicator(activeBtn.dataset.tab);
});
