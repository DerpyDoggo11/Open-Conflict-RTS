export interface IntermissionTroopOptions {
    type: string;
    label: string;
    cost: number;
    iconPath?: string;
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

    constructor(options: IntermissionTroopSelectorOptions) {
        const { troops, credits = 100, onSelect, onCancel } = options;
        this._credits = credits;

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

        for (const troop of troops) {
            const card = document.createElement('button');
            card.className = 'intermission-troop-selector__card';
            card.dataset.troop = troop.type;

            if (troop.iconPath) {
                const icon = document.createElement('img');
                icon.className = 'intermission-troop-selector__icon';
                icon.src = troop.iconPath;
                icon.alt = troop.label;
                card.appendChild(icon);
            }

            const name = document.createElement('span');
            name.className = 'intermission-troop-selector__name';
            name.textContent = troop.label;

            const cost = document.createElement('span');
            cost.className = 'intermission-troop-selector__cost sublabel';
            cost.textContent = `Cost: ${troop.cost}c`;

            card.appendChild(name);
            card.appendChild(cost);

            card.addEventListener('click', () => {
                this._grid.querySelectorAll('.intermission-troop-selector__card').forEach(c => 
                    c.classList.remove('intermission-troop-selector__card--selected')
                )
                card.classList.add('intermission-troop-selector__card--selected');
                onSelect(troop.type);
                this.close();
            });

            this._grid.appendChild(card);
        }
        panel.appendChild(this._grid);

        this._creditsElement = document.createElement('div');
        this._creditsElement.className = 'intermission-troop-selector__credits sublabel';
        this._creditsElement.textContent = `Credits: ${this._credits}`;
        panel.appendChild(this._creditsElement);
    }

    setCredits(amount: number): void {
        this._credits = amount;
        this._creditsElement.textContent = `Credits: ${amount}`;
    }

    open(): void {
        this.element.classList.add('intermission-troop-selector--open');
    }

    close(): void {
        this.element.classList.remove('intermission-troop-selector--open')
        this._grid.querySelectorAll('.intermission-troop-selector__card').forEach(c =>
            c.classList.remove('intermission-troop-selector__card--selected')
        );
    }
}

