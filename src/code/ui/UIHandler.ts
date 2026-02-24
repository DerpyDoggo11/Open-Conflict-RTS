export interface IMenu {
    mount(container: HTMLElement): void;
    onShow?(): void;
    onHide?(): void;
    destroy?(): void;
}

export class UIHandler {
    private overlay: HTMLElement;
    private menus = new Map<string, { menu: IMenu; el: HTMLElement}>();
    private current: string | null = null;

    constructor() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'ui-root';
        Object.assign(this.overlay.style, {
            position: 'fixed',
            inset: '0',
            pointerEvents: 'none', 
            zIndex: '10',
        });
        
        document.body.appendChild(this.overlay);
    }

    register(key: string, menu: IMenu): this {
        if (this.menus.has(key)) {
            console.warn(`UIManager: menu "${key}" already registered.`);
            return this;
        }

        const el = document.createElement('div');
        el.dataset.menu = key;
        el.style.display = 'none';
        el.style.width = '100%';
        el.style.height = '100%';

        this.overlay.appendChild(el);
        menu.mount(el);
        this.menus.set(key, { menu, el });

        return this;
    }

    show(key: string): void {
        if (!this.menus.has(key)) {
        console.error(`UIManager: no menu registered as "${key}".`);
        return;
        }

        if (this.current && this.current !== key) {
        const prev = this.menus.get(this.current)!;
        prev.menu.onHide?.();
        prev.el.style.display = 'none';
        }

        const next = this.menus.get(key)!;
        next.el.style.display = '';
        next.menu.onShow?.();
        this.current = key;
    }

    hideAll(): void {
        if (this.current) {
        const prev = this.menus.get(this.current)!;
        prev.menu.onHide?.();
        prev.el.style.display = 'none';
        this.current = null;
        }
    }

    getCurrentMenu(): string | null {
        return this.current;
    }

    destroy(): void {
        this.menus.forEach(({ menu }) => menu.destroy?.());
        this.overlay.remove();
    }
}