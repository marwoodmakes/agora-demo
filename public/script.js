let isRecording = false;
let recognition;
let recognitionTimeout;
let finalTranscript = "";
let chatLog = [];

const recordBtn = document.getElementById("recordButton");
const downloadBtn = document.getElementById("downloadBtn");
const chatDiv = document.getElementById("chat");
const audioPlayer = document.getElementById("audioPlayer");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function createRecognition() {
  const recog = new SpeechRecognition();
  recog.continuous = false;
  recog.lang = "en-US";

  recog.onstart = () => {
    finalTranscript = "";
    recordBtn.innerText = "Listening...";
    recognitionTimeout = setTimeout(() => recog.stop(), 10000);
  };

  recog.onresult = (event) => {
    finalTranscript = event.results[0][0].transcript;
  };

  recog.onend = async () => {
    clearTimeout(recognitionTimeout);
    isRecording = false;
    recordBtn.innerText = "Click to Talk";

    if (!finalTranscript) {
      alert("No speech detected.");
      return;
    }

    // User bubble with favicon avatar
    const userBubble = document.createElement("div");
    userBubble.className = "chat-bubble user";
    userBubble.innerHTML = `
      <img src="https://cdn.shopify.com/s/files/1/0910/8389/9266/files/ChatGPT_Image_Jun_16_2025_09_51_46_AM.png?v=1750063921" class="avatar" alt="User" />
      <div class="text">User: ${finalTranscript}</div>
    `;
    chatDiv.appendChild(userBubble);
    chatLog.push("User: " + finalTranscript);

    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: finalTranscript })
      });

      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();

      // Agent bubble with emoji avatar
      const agentBubble = document.createElement("div");
      agentBubble.className = "chat-bubble agent";
      agentBubble.innerHTML = `
        <div class="emoji-avatar">🤖</div>
        <div class="text">Agent: ${data.text}</div>
      `;
      chatDiv.appendChild(agentBubble);
      chatLog.push("Agent: " + data.text);

      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: "audio/mp3" }
      );
      audioPlayer.src = URL.createObjectURL(audioBlob);
      audioPlayer.play();

    } catch (err) {
      console.error("Fetch error:", err);
      alert("❌ Failed to get response from server.");
    }
  };

  recog.onerror = (event) => {
    console.error("Speech error:", event.error);
    isRecording = false;
    clearTimeout(recognitionTimeout);
    recordBtn.innerText = "Click to Talk";
    alert("Speech recognition error: " + event.error);
  };

  return recog;
}

recordBtn.onclick = () => {
  if (!SpeechRecognition) {
    alert("Speech recognition not supported in this browser.");
    return;
  }

  if (!isRecording) {
    recognition = createRecognition();
    isRecording = true;
    recognition.start();
  } else {
    isRecording = false;
    recognition.stop();
    clearTimeout(recognitionTimeout);
  }
};

downloadBtn.onclick = () => {
  const blob = new Blob([chatLog.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chat-transcript.txt";
  a.click();
  URL.revokeObjectURL(url);
};
