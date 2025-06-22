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

  // Create user bubble with placeholder
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
    const audioBlob = new Blob(audioChunks, { type: "audio/mp3" });
    const formData = new FormData();
    formData.append("audio", audioBlob, "input.mp3");

    try {
      const res = await fetch("/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();

      // Replace user placeholder with actual transcription
      const textDiv = userBubble.querySelector(".text");
      textDiv.textContent = data.text;
      chatLog.push("User: " + data.text);
      scrollToBottom();

      // Display agent response
      const agentBubble = document.createElement("div");
      agentBubble.className = "chat-bubble agent";
      agentBubble.innerHTML = `
        <div class="emoji-avatar">🤖</div>
        <div class="text">${data.text}</div>
      `;
      chatDiv.appendChild(agentBubble);
      chatLog.push("Agent: " + data.text);
      scrollToBottom();

      const audioBlobOut = new Blob(
        [Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))],
        { type: "audio/mpeg" }
      );
      audioPlayer.src = URL.createObjectURL(audioBlobOut);
      audioPlayer.play();

    } catch (err) {
      console.error("Fetch error:", err);
      alert("❌ Failed to get response from server.");
    } finally {
      recordBtn.disabled = false;
      recordBtn.innerText = "Click to Talk";
    }
  };

  mediaRecorder.start();
  recordBtn.innerText = "Recording... (click to stop)";
  recordBtn.disabled = true;

  // Auto-stop after 10 seconds
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
