import cors from "cors";
import express from "express";
import { geminiEndpoint } from "./gemeniEndpoint";
import { toneSpecificEndpoint } from "./toneSpecificEndpoint";
import { mockToneSpecificEndpoint } from "./mockToneSpecificEndpoint";

const app = express();

// CORS middleware - must come BEFORE other middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"], // Add your frontend URLs
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"],
  })
);

// Other middleware
app.use(express.json());

// Routes
app.post("/gemini", geminiEndpoint);
// app.post("/gemini-tone", toneSpecificEndpoint);
app.post("/gemini-tone", mockToneSpecificEndpoint);

export default app;
