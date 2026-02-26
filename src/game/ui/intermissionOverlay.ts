export class intermissionOverlay {
  private bar: HTMLElement;
  private timerLabel: HTMLElement;
  private readyBtn: HTMLElement;
  private onReady: () => void;

  constructor(durationMs: number, onReady: () => void) {
    this.onReady = onReady;
    this.bar = document.getElementById('intermission-bar') as HTMLElement;
    this.timerLabel = document.getElementById('intermission-timer') as HTMLElement;
    this.readyBtn = document.getElementById('ready-btn') as HTMLElement;

    this.readyBtn.addEventListener('click', () => this.triggerReady());
    this.bar.classList.remove('hidden');
    this.startTimer(durationMs);
  }

  private startTimer(durationMs: number): void {
    const endTime = Date.now() + durationMs;

    const tick = () => {
      const remaining = Math.max(0, endTime - Date.now());
      const secs = Math.ceil(remaining / 1000);
      const mins = Math.floor(secs / 60);
      const s = secs % 60;
      this.timerLabel.textContent = `Intermission: ${mins}:${s.toString().padStart(2, '0')}`;

      const pctFill = document.getElementById('intermission-fill') as HTMLElement;
      pctFill.style.width = ((remaining / durationMs) * 100) + '%';

      if (remaining <= 0) {
        this.triggerReady();
      } else {
        requestAnimationFrame(tick);
      }
    };
    tick();
  }

  private triggerReady(): void {
    this.bar.classList.add('hidden');
    this.onReady();
  }
}