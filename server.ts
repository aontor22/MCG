import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required. Please set it in Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for audio uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // 1. Audio Transcription using gemini-3.5-flash
  app.post("/api/gemini/transcribe", async (req, res) => {
    try {
      const { audioData, mimeType, prompt } = req.body;
      if (!audioData) {
        return res.status(400).json({ error: "audioData (base64) is required" });
      }

      const ai = getGeminiClient();
      const cleanMimeType = mimeType || "audio/webm";

      const systemPrompt = prompt || 
        "You are an accurate audio transcriber and Morse code audio analyst. " +
        "If the audio contains spoken words, transcribe them verbatim. " +
        "If the audio contains Morse code telegraph beeps or dits/dahs, decode the Morse audio into text. " +
        "Return only the clear, accurate transcription text without conversational filler or prefixes.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: audioData,
            },
          },
          {
            text: systemPrompt,
          },
        ],
      });

      const transcription = response.text || "";
      res.json({ transcription });
    } catch (err: any) {
      console.error("Transcription error:", err);
      res.status(500).json({ error: err.message || "Failed to transcribe audio" });
    }
  });

  // 2. Multi-turn Chat with role instructions, model selection, and Search Grounding
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const {
        messages,
        systemInstruction,
        model = "gemini-3.5-flash",
        enableSearch = false,
      } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }

      const ai = getGeminiClient();

      // Validate allowed models per guidelines
      const allowedModels = [
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.1-pro-preview",
        "gemini-3.7-flash",
      ];
      const selectedModel = allowedModels.includes(model) ? model : "gemini-3.5-flash";

      const contents = messages.map((m: { role: string; text: string }) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

      const config: any = {
        systemInstruction:
          systemInstruction ||
          "You are an expert telecommunications and Morse code assistant. You help users understand, decode, learn, and practice Morse code across world alphabets and history.",
      };

      // Enable Google Search grounding if requested (specifically supported on gemini-3.5-flash and gemini-3.7-flash)
      if (enableSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      const text = response.text || "";

      // Extract search grounding metadata
      const candidate = response.candidates?.[0];
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const webSearchQueries = candidate?.groundingMetadata?.webSearchQueries || [];

      res.json({
        text,
        groundingSources: groundingChunks.map((chunk: any) => ({
          title: chunk.web?.title || "Web Source",
          uri: chunk.web?.uri || "",
        })).filter((source: any) => source.uri),
        searchQueries: webSearchQueries,
      });
    } catch (err: any) {
      console.error("Chat error:", err);
      res.status(500).json({ error: err.message || "Failed to generate chat response" });
    }
  });

  // Create HTTP server
  const server = http.createServer(app);

  // 3. Live API Voice Conversations WebSocket Server (/live) using gemini-3.1-flash-live-preview
  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("connection", async (clientWs: WebSocket) => {
    let session: any = null;

    try {
      const ai = getGeminiClient();
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction:
            "You are an engaging voice companion and Morse code tutor. " +
            "You can converse naturally, teach Morse code signals, explain telegraph history, " +
            "and assist the user with translation, practice exercises, or general questions.",
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "sessionClosed" }));
            }
          },
          onerror: (err: any) => {
            console.error("Live session error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "error", message: String(err) }));
            }
          },
        },
      });

      clientWs.send(JSON.stringify({ type: "ready", message: "Connected to Gemini Live" }));
    } catch (err: any) {
      console.error("Failed to connect Live session:", err);
      clientWs.send(JSON.stringify({ type: "error", message: err.message || "Failed to initialize Live API" }));
      clientWs.close();
      return;
    }

    clientWs.on("message", (data: Buffer | string) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.type === "audio" && payload.audio && session) {
          session.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } else if (payload.type === "text" && payload.text && session) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err) {
        console.error("Error processing client live message:", err);
      }
    });

    clientWs.on("close", () => {
      if (session) {
        try {
          session.close();
        } catch (_) {}
      }
    });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
