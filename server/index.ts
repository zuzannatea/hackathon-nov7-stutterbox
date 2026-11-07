import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createAnalyzeRouter } from "./routes/analyze.js";
import { createGenerateSpeechRouter } from "./routes/generateSpeech.js";
import { analyseSpeech } from "./services/analysis.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({ message: "Speech Coach API is running!" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/analyze", createAnalyzeRouter(analyseSpeech));
app.use("/api/generate-speech", createGenerateSpeechRouter());

const jsonErrorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (typeof err === "object" && err !== null && "type" in err) {
    const errorType = err.type;
    if (errorType === "entity.too.large") {
      res.status(413).json({ error: "Request body is too large." });
      return;
    }
    if (errorType === "entity.parse.failed") {
      res.status(400).json({ error: "Request body contains invalid JSON." });
      return;
    }
  }
  res.status(500).json({ error: "An unexpected server error occurred." });
};

app.use(jsonErrorHandler);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
