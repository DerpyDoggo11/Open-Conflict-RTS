export class IntermissionOverlay {
  private bar: HTMLElement;
  private timerLabel: HTMLElement;
  private pctFill: HTMLElement;
  private readyBtn: HTMLElement;
  private onReady: () => void;

  constructor(onReady: () => void) {
    this.onReady = onReady;
    this.bar = document.getElementById('intermission-bar') as HTMLElement;
    this.timerLabel = document.getElementById('intermission-timer') as HTMLElement;
    this.pctFill = document.getElementById('intermission-fill') as HTMLElement;
    this.readyBtn = document.getElementById('ready-btn') as HTMLElement;
    this.readyBtn.addEventListener('click', () => this.triggerReady());
    this.bar.classList.remove('hidden');
  }

  tick(timeRemaining: number, intermissionDuration: number, gameDuration: number): void {
    
    const intermisisonTimeRemaining = timeRemaining - (gameDuration - intermissionDuration)
    console.log(intermisisonTimeRemaining)
    const mins = Math.floor(intermisisonTimeRemaining / 60);
    const s = String(intermisisonTimeRemaining % 60).padStart(2, '0');
    this.timerLabel.textContent = `Intermission: ${mins}:${s}`;
    this.pctFill.style.width = ((intermisisonTimeRemaining / intermissionDuration) * 100) + '%';

    if (intermisisonTimeRemaining <= 0) {
      this.triggerReady();
    }
  }

  private triggerReady(): void {
    this.bar.classList.add('hidden');
    const gameTimerBar = document.getElementById('game-timer-bar') as HTMLElement;
    gameTimerBar.classList.remove('hidden');
    this.onReady();
  }
}