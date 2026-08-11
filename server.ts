import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { adaptExpress } from "./src/api-handlers/adapter";
import { handleAiStatus } from "./src/api-handlers/aiStatus";
import { handleAutoCorrect } from "./src/api-handlers/autoCorrect";
import { handleAutoDetect } from "./src/api-handlers/autoDetect";
import { handleChat } from "./src/api-handlers/chat";
import { handleClassify } from "./src/api-handlers/classify";
import { handleDistil } from "./src/api-handlers/distil";
import { handleEmbed } from "./src/api-handlers/embed";
import { handleThinkingPattern } from "./src/api-handlers/thinkingPattern";
import { handleThemes } from "./src/api-handlers/themes";
import { handleConnections } from "./src/api-handlers/connections";
import { handleReflections } from "./src/api-handlers/reflections";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Shared API Endpoints (Single Source of Truth in /src/api-handlers)
  app.get("/api/ai-status", adaptExpress(handleAiStatus));
  app.post("/api/auto-correct", adaptExpress(handleAutoCorrect));
  app.post("/api/auto-detect", adaptExpress(handleAutoDetect));
  app.post("/api/chat", adaptExpress(handleChat));
  app.post("/api/classify", adaptExpress(handleClassify));
  app.post("/api/distil", adaptExpress(handleDistil));
  app.post("/api/embed", adaptExpress(handleEmbed));
  app.post("/api/thinking-pattern", adaptExpress(handleThinkingPattern));
  app.post("/api/themes", adaptExpress(handleThemes));
  app.post("/api/connections", adaptExpress(handleConnections));
  app.post("/api/reflections", adaptExpress(handleReflections));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Noesis Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
