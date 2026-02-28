export function tickGameTimer(timeRemaining: number, intermissionDuration: number, gameDuration: number): void {
  const label = document.getElementById('game-timer-label') as HTMLElement;
  const fill = document.getElementById('game-timer-fill') as HTMLElement;

  const mins = Math.floor(timeRemaining / 60);
  const secs = String(timeRemaining % 60).padStart(2, '0');
  label.textContent = `Time Remaining: ${mins}:${secs}`;
  fill.style.width = ((timeRemaining / (gameDuration - intermissionDuration)) * 100) + '%';

  if (timeRemaining <= 0) {
    const bar = document.getElementById('game-timer-bar') as HTMLElement;
    bar.classList.add('hidden');
  }
}