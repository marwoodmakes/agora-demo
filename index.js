const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const multer = require("multer");
const { OpenAI } = require("openai");
const player = require("play-sound")();
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(express.json()); // Required for JSON POST
app.use(express.static("public")); // Serve frontend files

// File upload config
const upload = multer({ dest: "uploads/" });

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔊 Test local playback
app.get("/test", async (req, res) => {
  try {
    const prompt = "Can I help you with a quote today?";

    const gptRes = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a professional AI assistant trained to speak in a clear, calm, friendly tone. Keep replies short and use simple, natural phrasing.",
        },
        { role: "user", content: prompt },
      ],
    });

    const reply = gptRes.choices[0].message.content;
    console.log("🧠 GPT reply:", reply);

    const voiceRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          accept: "audio/mpeg",
          "content-type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: reply,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.8,
            similarity_boost: 0.6,
          },
        }),
      }
    );

    if (!voiceRes.ok) {
      const errorText = await voiceRes.text();
      console.error("🛑 ElevenLabs API Error:", voiceRes.status, errorText);
      return res.status(500).send("ElevenLabs API failed");
    }

    const audioPath = "./voices/output.mp3";
    const audioBuffer = await voiceRes.buffer();
    fs.writeFileSync(audioPath, audioBuffer);

    console.log("🔊 Playing voice reply...");
    player.play(audioPath, (err) => {
      if (err) console.error("Audio playback error:", err);
    });

    res.send("✅ Voice reply generated and playing locally.");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Something went wrong");
  }
});

// 🎙️ /ask: Plain text to GPT + ElevenLabs
app.post("/ask", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const gptRes = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful, friendly AI assistant for a trades business. Keep responses short and clear.",
        },
        { role: "user", content: userMessage },
      ],
    });

    const reply = gptRes.choices[0].message.content;
    console.log("🧠 GPT said:", reply);

    const voiceRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          accept: "audio/mpeg",
          "content-type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: reply,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.85,
          },
        }),
      }
    );

    if (!voiceRes.ok) {
      const errorText = await voiceRes.text();
      console.error("🛑 ElevenLabs API Error:", voiceRes.status, errorText);
      return res.status(500).send("ElevenLabs API failed");
    }

    const audioBuffer = await voiceRes.buffer();
    const audioBase64 = audioBuffer.toString("base64");

    res.json({ text: reply, audio: audioBase64 });
  } catch (err) {
    console.error("/ask error:", err);
    res.status(500).send("Something went wrong");
  }
});

// 🔁 /transcribe: Handle audio → Whisper → GPT → ElevenLabs
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const filePath = req.file.path;

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });

    const userText = transcription.text;
    console.log("📝 Whisper transcript:", userText);

    const gptRes = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful, friendly AI assistant for a trades business. Keep responses short and clear.",
        },
        { role: "user", content: userText },
      ],
    });

    const reply = gptRes.choices[0].message.content;

    const voiceRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          accept: "audio/mpeg",
          "content-type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: reply,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.85,
          },
        }),
      }
    );

    if (!voiceRes.ok) {
      const errorText = await voiceRes.text();
      console.error("🛑 ElevenLabs API Error:", voiceRes.status, errorText);
      return res.status(500).send("ElevenLabs API failed");
    }

    const audioBuffer = await voiceRes.buffer();
    const audioBase64 = audioBuffer.toString("base64");

    res.json({ text: reply, audio: audioBase64 });
  } catch (err) {
    console.error("/transcribe error:", err);
    res.status(500).send("Whisper processing failed");
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Sandbox running on http://localhost:${PORT}`);
});
