import express, { Application, Request, Response } from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import dns from "dns";
import connectDB from "./config/db";

// Force IPv4 first for DNS resolution to avoid ENOTFOUND issues in Node.js 17+
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { ensureDefaultAdmin } from "./utils/ensureDefaultAdmin";
import { seedHeaderCategories } from "./utils/seedHeaderCategories";
import { initializeSocket } from "./socket/socketService";

// Load environment variables
dotenv.config();

const app: Application = express();
const httpServer = createServer(app);

// Comprehensive CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://geeta.today",
  "https://www.geeta.today",
  "http://geeta.today",
  "http://www.geeta.today",
  "https://api.geeta.today",

  // Add more origins from environment variable if needed, cleaning up quotes and trailing slashes
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map(url => url.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, ''))
    : [])
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Normalize origin (remove trailing slash and lowercase)
    const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();

    // Special case: allow any geeta.today domain or localhost
    const isGeetaToday = normalizedOrigin.endsWith("geeta.today") ||
                        normalizedOrigin.includes("geeta.today");

    const isLocalhost = normalizedOrigin.startsWith("http://localhost:") ||
                       normalizedOrigin.startsWith("http://127.0.0.1:") ||
                       normalizedOrigin.startsWith("https://localhost:");

    if (isGeetaToday || isLocalhost) {
      return callback(null, true);
    }

    // Check against the allowed list as a fallback
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.replace(/\/$/, '').toLowerCase();
      return normalizedOrigin === normalizedAllowed;
    });

    if (isAllowed) {
      return callback(null, true);
    }

    // Log rejected origin for debugging in production
    console.warn(`[CORS] Request from rejected origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Allow-Headers",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
    "Cache-Control",
    "Expires",
    "Pragma",
    "x-api-key",
    "x-module-type"
  ],
  exposedHeaders: ["Content-Length", "Content-Type", "X-Total-Count", "Set-Cookie"],
  maxAge: 86400,
  optionsSuccessStatus: 200
};

// Apply CORS middleware first
app.use(cors(corsOptions));

// Explicit handle for OPTIONS requests (redundant but safe)
app.options("*", cors(corsOptions));

// Debug middleware - log all incoming requests
app.use((req: Request, _res: Response, next) => {
  if (process.env.NODE_ENV !== 'production' || req.method !== 'OPTIONS') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'N/A'}`);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Socket.io
const io = initializeSocket(httpServer);
app.set("io", io);

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Geeta Stores API Server is running!",
    version: "1.0.0",
    socketIO: "Listening for WebSocket connections",
  });
});


// API Routes
app.use("/api/v1", routes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Connect DB then ensure default admin exists
  await connectDB();
  await ensureDefaultAdmin();
  await seedHeaderCategories();

  httpServer.listen(PORT, () => {
    console.log("\n\x1b[32m✓\x1b[0m \x1b[1mGeeta Stores Server Started\x1b[0m");
    console.log(`   \x1b[36mPort:\x1b[0m http://localhost:${PORT}`);
    console.log(
      `   \x1b[36mEnvironment:\x1b[0m ${process.env.NODE_ENV || "development"}`
    );
    console.log(`   \x1b[36mSocket.IO:\x1b[0m ✓ Ready for connections\n`);
  });
}

startServer().catch((err) => {
  console.error("\n\x1b[31m✗ Failed to start server\x1b[0m");
  console.error(err);
  process.exit(1);
});
