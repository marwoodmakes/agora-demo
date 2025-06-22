let mediaRecorder;
let audioChunks = [];
let chatLog = [];

const recordBtn = document.getElementById("recordButton");
const downloadBtn = document.getElementById("downloadBtn");
const chatDiv = document.getElementById("chat");
const audioPlayer = document.getElementById("audioPlayer");

const scrollToBottom = () => {
  chatDiv.scrollTop = chatDiv.scrollHeight;
};

const startRecording = async () => {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    alert("Your browser does not support audio recording.");
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  // Create user bubble with 🎤 Listening...
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble user";
  userBubble.innerHTML = `
    <img src="https://cdn.shopify.com/s/files/1/0910/8389/9266/files/ChatGPT_Image_Jun_16_2025_09_51_46_AM.png?v=1750063921" class="avatar" alt="User" />
    <div class="text">🎤 Listening...</div>
  `;
  chatDiv.appendChild(userBubble);
  scrollToBottom();

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("audio", audioBlob, "input.webm");

    // Update user bubble to say "🟣 Transcribing..."
    const userText = userBubble.querySelector(".text");
    userText.textContent = "🟣 Transcribing...";
    chatLog.push("User: [Recording...]");

    try {
      const res = await fetch("/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      // Replace bubble content with transcript
      userText.textContent = data.transcript || "[No transcript]";
      chatLog.push("User: " + data.transcript);

      // Add agent bubble
      const agentBubble = document.createElement("div");
      agentBubble.className = "chat-bubble agent";
      agentBubble.innerHTML = `
        <div class="emoji-avatar">🤖</div>
        <div class="text">${data.text}</div>
      `;
      chatDiv.appendChild(agentBubble);
      chatLog.push("Agent: " + data.text);
      scrollToBottom();

      // Playback
      const audioBlobOut = new Blob(
        [Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))],
        { type: "audio/mpeg" }
      );
      audioPlayer.src = URL.createObjectURL(audioBlobOut);
      audioPlayer.play();
    } catch (err) {
      console.error("Fetch error:", err);
      userText.textContent = "❌ Could not transcribe.";
    } finally {
      recordBtn.innerText = "Click to Talk";
      recordBtn.disabled = false;
    }
  };

  mediaRecorder.start();
  recordBtn.innerText = "Recording... (click to stop)";
  recordBtn.disabled = true;

  setTimeout(() => {
    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }, 10000);
};

recordBtn.onclick = async () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  } else {
    await startRecording();
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
