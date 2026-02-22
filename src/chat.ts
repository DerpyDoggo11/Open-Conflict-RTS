import { Client } from "colyseus.js";

const client = new Client("ws://localhost:2567");

async function initChat() {
  const room = await client.joinOrCreate("chat_room");
  console.log("Joined as", room.sessionId);

  // Listen for new messages
  room.state.messages.onAdd((message: { sender: any; text: any; }) => {
    const div = document.createElement("div");
    div.textContent = `[${message.sender}]: ${message.text}`;
    document.getElementById("messages")!.appendChild(div);
  });

  // Send button
  document.getElementById("send")!.addEventListener("click", () => {
    const input = document.getElementById("input") as HTMLInputElement;
    if (input.value.trim()) {
      room.send("chat", { text: input.value.trim() });
      input.value = "";
    }
  });
}

initChat();