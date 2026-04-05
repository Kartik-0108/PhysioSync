import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors()); // Enable CORS for all origins (can be restricted later)
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/analyze-overhead-reach", (req, res) => {
    const data = req.body;
    
    // Basic analysis logic
    let feedback = "Good vertical alignment. Keep it up!";
    let score = data.symmetryScore || 100;
    
    if (score < 80) {
      feedback = "Try to reach equally with both arms.";
    }

    res.json({
      status: "success",
      repCount: data.reps,
      accuracyScore: 95,
      symmetryScore: score,
      postureFeedback: feedback,
      mistakes: []
    });
  });

  app.post("/api/analyze-knee-bend", (req, res) => {
    const data = req.body;
    res.json({
      status: "success",
      repCount: data.reps,
      activeLeg: data.activeLeg,
      accuracyScore: 92,
      mistakes: []
    });
  });

  app.post("/api/analyze-frame", (req, res) => {
    res.json({
      status: "success",
      analysis: {
        postureScore: 95,
        jointAngles: {
          leftKnee: 120,
          rightKnee: 122,
          backAngle: 175
        },
        recommendations: ["Keep back straight", "Lower hips slightly"]
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
