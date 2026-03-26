import { TimerBanner } from '../components/timerBannerWidget.js';
import { ReadyWidget } from '../components/readyWidget.js';

export interface IntermissionOptions {
    durationSeconds?: number;
    totalPlayers?: number;
    onStart?: () => void;
}

export function createIntermissionOverlay(options: IntermissionOptions = {}): HTMLElement {
    const { 
        durationSeconds = 60, 
        totalPlayers = 2,
        onStart,
    } = options;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const flash = document.createElement('div');
    flash.className = 'start-flash';
    overlay.appendChild(flash);

    function triggerStart(): void {
        flash.classList.add('start-flash--visible');
        setTimeout(() => {
            flash.classList.remove('start-flash--visible');
            onStart?.();
        }, 150);
    }

    const timer = new TimerBanner({
        durationSeconds,
        label: 'Intermission',
        onComplete: triggerStart,
    });
    overlay.appendChild(timer.element);
    timer.start();

    const ready = new ReadyWidget({
        totalPlayers,
        onReady: (isReady) => {
            console.log('player ready:', isReady);
        },
    });
    overlay.appendChild(ready.element);

    return overlay;
}