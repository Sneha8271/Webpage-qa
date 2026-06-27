const BACKEND_URL = "http://127.0.0.1:8000";
const SESSION_ID = "session_" + Date.now();

function addBubble(text, type) {
  const chatArea = document.getElementById("chatArea");
  const bubble = document.createElement("div");
  bubble.classList.add("bubble", type);
  bubble.textContent = text;
  chatArea.appendChild(bubble);
  chatArea.scrollTop = chatArea.scrollHeight;
  return bubble;
}

document.getElementById("extractBtn").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.textContent = "Extracting page text...";
  status.className = "";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => document.body.innerText
    }, async (results) => {
      const text = results[0].result;
      status.textContent = "Sending to backend...";

      try {
        const response = await fetch(`${BACKEND_URL}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: SESSION_ID, text: text })
        });

        const data = await response.json();
        status.textContent = `Ready! ${data.chunks} chunks processed.`;
        status.className = "success";
        addBubble("Page processed! Ask me anything about it.", "bot");

      } catch (error) {
        status.textContent = "Backend error! Is it running?";
        status.className = "error";
      }
    });
  });
});

document.getElementById("askBtn").addEventListener("click", askQuestion);
document.getElementById("questionInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") askQuestion();
});

async function askQuestion() {
  const input = document.getElementById("questionInput");
  const question = input.value.trim();
  if (!question) return;

  addBubble(question, "user");
  input.value = "";

  const thinking = addBubble("Thinking...", "thinking");

  try {
    const response = await fetch(`${BACKEND_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: SESSION_ID, question: question })
    });

    const data = await response.json();
    thinking.remove();
    addBubble(data.answer || data.error, "bot");

  } catch (error) {
    thinking.remove();
    addBubble("Backend error! Is it running?", "bot");
  }
}