import { createIntermissionOverlay } from "./overlays/intermissionOverlay";
import { initGame } from "../game/gameInit";

const app = document.getElementById('app')!;

initGame().then(() => {
    const overlay = createIntermissionOverlay({
        durationSeconds: 60,
        totalPlayers: 2,
        onStart: () => {
            console.log('Game starting!');
        },
    });
    app.appendChild(overlay);
});