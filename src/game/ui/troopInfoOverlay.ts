export class troopInfoOverlay {
  private panel: HTMLElement;
  private portrait: HTMLImageElement;
  private healthFill: HTMLElement;
  private healthText: HTMLElement;
  private nameLabel: HTMLElement;

  constructor() {
    this.panel = document.getElementById('selected-unit-panel') as HTMLElement;
    this.portrait = document.getElementById('unit-portrait') as HTMLImageElement;
    this.healthFill = document.getElementById('unit-health-fill') as HTMLElement;
    this.healthText = document.getElementById('unit-health-text') as HTMLElement;
    this.nameLabel = document.getElementById('unit-name') as HTMLElement;
  }

  show(spritePath: string, troopType: string, health: number, maxHealth: number): void {
    this.portrait.src = spritePath + '0003.png';
    this.nameLabel.textContent = troopType;
    this.updateHealth(health, maxHealth);
    this.panel.classList.remove('hidden');
  }

  updateHealth(health: number, maxHealth: number): void {
    const pct = Math.max(0, (health / maxHealth) * 100);
    this.healthFill.style.width = pct + '%';
    this.healthFill.style.background = pct > 50 ? '#3a9e7e' : pct > 25 ? '#f59e0b' : '#ef4444';
    this.healthText.textContent = `${health} / ${maxHealth}`;
  }

  hide(): void {
    this.panel.classList.add('hidden');
  }
}