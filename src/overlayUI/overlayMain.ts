import { createIntermissionOverlay } from './overlays/intermissionOverlay.ts';

const app = document.getElementById('app')!;

const overlay = createIntermissionOverlay({
    durationSeconds: 60,
    totalPlayers: 2,
    onStart: () => {
        console.log('Game starting!');
        // swap overlay, notify server, etc.
    },
});

app.appendChild(overlay);