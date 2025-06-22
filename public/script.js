let mediaRecorder;
let audioChunks = [];
let chatLog = [];

const recordBtn = document.getElementById("recordButton");
const downloadBtn = document.getElementById("downloadBtn");
const chatDiv = document.getElementById("chat");
const audioPlayer = document.getElementById("audioPlayer");

let currentUserBubble = null;

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

  // Create user bubble
  currentUserBubble = document.createElement("div");
  currentUserBubble.className = "chat-bubble user";
  currentUserBubble.innerHTML = `
    <img src="https://cdn.shopify.com/s/files/1/0910/8389/9266/files/ChatGPT_Image_Jun_16_2025_09_51_46_AM.png?v=1750063921" class="avatar" alt="User" />
    <div class="text">🎤 Listening...</div>
  `;
  chatDiv.appendChild(currentUserBubble);
  scrollToBottom();

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("audio", audioBlob, "input.webm");

    currentUserBubble.querySelector(".text").textContent = "🟣 Transcribing...";
    chatLog.push("User: [Recording...]");
    scrollToBottom();

    try {
      const res = await fetch("/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      // Show user transcript
      const userTranscript = data.transcript || "[No transcript]";
      currentUserBubble.querySelector(".text").textContent = userTranscript;
      chatLog.push("User: " + userTranscript);

      // Add agent bubble
      const agentBubble = document.createElement("div");
      agentBubble.className = "chat-bubble agent";
      agentBubble.innerHTML = `
        <div class="emoji-avatar">🤖</div>
        <div class="text typing"></div>
      `;
      chatDiv.appendChild(agentBubble);
      chatLog.push("Agent: " + data.text);
      scrollToBottom();

      // Typing animation
      const textEl = agentBubble.querySelector(".text");
      const fullText = data.text;
      let i = 0;
      const typingSpeed = 25;
      const typeText = () => {
        if (i < fullText.length) {
          textEl.textContent += fullText.charAt(i);
          i++;
          scrollToBottom();
          setTimeout(typeText, typingSpeed);
        }
      };
      typeText();

      // Play audio reply
      const audioBlobOut = new Blob(
        [Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))],
        { type: "audio/mpeg" }
      );
      audioPlayer.src = URL.createObjectURL(audioBlobOut);
      audioPlayer.play();

    } catch (err) {
      console.error("Fetch error:", err);
      alert("❌ Failed to get response from server.");
    }

    recordBtn.innerText = "Click to Talk";
    recordBtn.classList.remove("recording");
  };

  mediaRecorder.start();
  recordBtn.innerText = "Recording... (click to stop)";
  recordBtn.classList.add("recording");

  // Auto-stop on silence
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  let silenceStart = null;
  const silenceThreshold = 0.01;
  const silenceDelay = 2000;

  function detectSilence() {
    analyser.getByteFrequencyData(data);
    const volume = data.reduce((a, b) => a + b) / data.length;

    if (volume < silenceThreshold * 255) {
      if (!silenceStart) silenceStart = Date.now();
      else if (Date.now() - silenceStart > silenceDelay && mediaRecorder.state === "recording") {
        console.log("🛑 Silence detected, stopping...");
        mediaRecorder.stop();
      }
    } else {
      silenceStart = null;
    }

    if (mediaRecorder.state === "recording") {
      requestAnimationFrame(detectSilence);
    }
  }
  detectSilence();
};

recordBtn.onclick = async () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recordBtn.innerText = "Processing...";
    recordBtn.classList.remove("recording");
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
