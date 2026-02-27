import { colyseusClient, type ChatMessage } from "../network/colyseusClient";

export class gameChat {
  private panel: HTMLElement;
  private messages: HTMLElement;
  private input: HTMLInputElement;
  private sessionId: string = "";

  constructor() {
    this.panel = document.getElementById("chat-panel") as HTMLElement;
    this.messages = document.getElementById("chat-messages") as HTMLElement;
    this.input = document.getElementById("chat-input") as HTMLInputElement;

    if (!this.panel || !this.messages || !this.input) {
      console.error("ChatPanel: missing DOM elements", {
        panel: this.panel,
        messages: this.messages,
        input: this.input,
      });
      return;
    }

    this.bindInput();
    colyseusClient.onChat(msg => this.appendMessage(msg));
  }
  

  private bindInput(): void {
    const sendBtn = document.getElementById("chat-send") as HTMLButtonElement;

    if (!sendBtn) {
      console.error("ChatPanel: missing #chat-send button");
      return;
    }
    sendBtn.addEventListener("click", () => this.send());

    this.input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.send();
      }
      e.stopPropagation();
    });
  }

  private send(): void {
    const text = this.input.value.trim();
    if (!text) return;
    colyseusClient.sendChat(text);
    this.input.value = "";
  }

  private appendMessage(msg: ChatMessage): void {
    const isSystem = msg.playerId === "system";
    const isSelf = msg.playerId === colyseusClient.sessionId;
    const time = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit",
    });

    const el = document.createElement("div");
    el.className = `flex flex-col gap-0.5 ${isSelf ? "items-end" : "items-start"}`;

    if (isSystem) {
      el.innerHTML = `
        <p class="text-xs text-tab-inactive italic text-center w-full px-2">${msg.text}</p>
      `;
    } else {
      el.innerHTML = `
        <p class="text-[10px] text-tab-inactive px-1">${msg.name} · ${time}</p>
        <div class="max-w-[85%] px-3 py-1.5 rounded-2xl text-sm
          ${isSelf
            ? "bg-accent-teal text-white rounded-tr-sm"
            : "bg-bg-card text-white rounded-tl-sm"}">
          ${this.escapeHtml(msg.text)}
        </div>
      `;
    }

    this.messages.appendChild(el);
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  show(): void {
    this.panel.style.display = 'flex';
  }

  hide(): void {
    this.panel.style.display = 'none';
  }
}