import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Server-side Gemini API client
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured on the server");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API routes FIRST
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.post("/api/ai-analytics", async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction:
          systemInstruction ||
          "Вы — опытный главный бизнес-аналитик и директор по развитию учебных центров и образовательных платформ (CRM/CMS). Ваш анализ должен быть структурированным, глубоким, практичным, дружелюбным и конкретным, на правильном русском языке с наглядным форматированием Markdown.",
        temperature: 0.6,
      },
    });

    const text = response.text || "";
    return res.json({ text });
  } catch (error: any) {
    console.error("Error in /api/ai-analytics:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate AI analytics",
      fallbackNeeded: true,
    });
  }
});

// Proxy for SMS Gateways (Cloud & Local) to prevent CORS issues
app.post("/api/send-sms-gateway", async (req, res) => {
  try {
    const { gatewayUrl, apiKey, deviceId, phone, message } = req.body;

    if (!gatewayUrl || !phone || !message) {
      return res.status(400).json({ error: "gatewayUrl, phone, and message are required" });
    }

    const cleanPhone = String(phone).replace(/[^0-9+]/g, "");

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    if (apiKey) {
      if (apiKey.includes(":") && !apiKey.startsWith("Basic ")) {
        // username:password format for basic auth
        const encoded = Buffer.from(apiKey.trim()).toString("base64");
        headers["Authorization"] = `Basic ${encoded}`;
      } else if (apiKey.startsWith("Basic ") || apiKey.startsWith("Bearer ")) {
        headers["Authorization"] = apiKey;
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["x-api-key"] = apiKey;
      }
    }

    // Build payload suitable for sms-gate.app and other gateways
    const payload = {
      phoneNumbers: [cleanPhone],
      phone: cleanPhone,
      to: cleanPhone,
      number: cleanPhone,
      message,
      text: message,
      deviceId: deviceId || undefined,
    };

    const targetUrl = gatewayUrl.trim();
    const fetchResponse = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const respText = await fetchResponse.text();
    let respJson: any = null;
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = { raw: respText };
    }

    if (!fetchResponse.ok) {
      return res.status(fetchResponse.status).json({
        error: `Шлюз вернул ошибку (${fetchResponse.status}): ${respText}`,
        details: respJson,
      });
    }

    return res.json({ success: true, data: respJson });
  } catch (error: any) {
    console.error("Error in /api/send-sms-gateway:", error);
    return res.status(500).json({
      error: `Ошибка отправки через шлюз: ${error.message || "Неизвестная ошибка"}`,
    });
  }
});

// Vite middleware setup
async function startServer() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
