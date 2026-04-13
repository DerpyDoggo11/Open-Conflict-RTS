export interface IntermissionTroopOptions {
  type: string;
  label: string;
  cost: number;
  iconPath: string;
}

export interface IntermissionTroopSelectorOptions {
  troops: IntermissionTroopOptions[];
  credits?: number;
  onSelect: (type: string) => void;
  onCancel: () => void;
}

export class IntermissionTroopSelectorOverlay {
  public readonly element: HTMLElement;
  private _credits: number;
  private _creditsElement: HTMLElement;
  private _grid: HTMLElement;
  private _troops: IntermissionTroopOptions[];
  private _onSelect: (type: string) => void;

  constructor(options: IntermissionTroopSelectorOptions) {
    const { troops, credits = 100, onSelect, onCancel } = options;
    this._credits = credits;
    this._troops = troops;
    this._onSelect = onSelect;

    this.element = document.createElement('div');
    this.element.className = 'intermission-troop-selector';
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        onCancel();
        this.close();
      }
    });

    const panel = document.createElement('div');
    panel.className = 'intermission-troop-selector__panel';
    this.element.appendChild(panel);

    this._grid = document.createElement('div');
    this._grid.className = 'intermission-troop-selector__grid';
    panel.appendChild(this._grid);

    this._creditsElement = document.createElement('div');
    this._creditsElement.className = 'intermission-troop-selector__credits sublabel';
    this._creditsElement.textContent = `Credits: ${this._credits}`;
    panel.appendChild(this._creditsElement);

    this._renderCards();
  }

  private _renderCards(): void {
    this._grid.innerHTML = '';

    for (const troop of this._troops) {
      const canAfford = troop.cost <= this._credits;

      const card = document.createElement('button');
      card.className = 'intermission-troop-selector__card';
      if (!canAfford) {
        card.classList.add('intermission-troop-selector__card--disabled');
        card.disabled = true;
      }
      card.dataset.troop = troop.type;

      const name = document.createElement('span');
      name.className = 'intermission-troop-selector__name';
      name.textContent = troop.label;

      const cost = document.createElement('span');
      cost.className = 'intermission-troop-selector__cost sublabel';
      cost.textContent = `Cost: ${troop.cost}c`;

      card.appendChild(name);
      card.appendChild(cost);

      if (troop.iconPath) {
        const icon = document.createElement('img');
        icon.className = 'intermission-troop-selector__icon';
        icon.src = troop.iconPath;
        icon.alt = troop.label;
        card.appendChild(icon);
      }

      card.addEventListener('click', () => {
        if (!canAfford) return;
        this._grid.querySelectorAll('.intermission-troop-selector__card').forEach(c =>
          c.classList.remove('intermission-troop-selector__card--selected')
        );
        card.classList.add('intermission-troop-selector__card--selected');
        this._onSelect(troop.type);
        this.close();
      });

      this._grid.appendChild(card);
    }
  }

  setCredits(amount: number): void {
    this._credits = amount;
    this._creditsElement.textContent = `Credits: ${amount}`;
    // Re-render cards so unaffordable ones get disabled
    this._renderCards();
  }

  open(): void {
    this.element.classList.add('intermission-troop-selector--open');
  }

  close(): void {
    this.element.classList.remove('intermission-troop-selector--open');
    this._grid.querySelectorAll('.intermission-troop-selector__card').forEach(c =>
      c.classList.remove('intermission-troop-selector__card--selected')
    );
  }
}