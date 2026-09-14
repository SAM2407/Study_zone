import express from 'express';
import cors from 'cors';
import cookieParser  from 'cookie-parser';
import userRouter from "./routes/user.routes.js";
import groupRoutes from "./routes/group.routes.js";
import resourceRoutes from "./routes/resource.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import plannerRoutes from "./routes/planner.routes.js";
const app = express();

/* -------------------- MIDDLEWARES -------------------- */

// CORS Configuration
const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:5173",
    "http://localhost:4173"
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow: no origin (curl/Render health checks), exact matches, OR any Vercel preview URL for this project
            if (
                !origin ||
                allowedOrigins.includes(origin) ||
                /https:\/\/study-zone[^.]*\.vercel\.app$/.test(origin)
            ) {
                callback(null, true);
            } else {
                callback(new Error(`CORS blocked: ${origin}`));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
);

// Health check — Render pings this to keep service alive
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
 
// Body Parser Middleware
app.use(express.json({limit:"10mb"}));
app.use(express.urlencoded({extended:true,limit:"10mb"}));

// Static Files
app.use(express.static("public"));

// Cookie Parser
app.use(cookieParser());

/* -------------------- ROUTES -------------------- */

app.use("/api/users", userRouter);
app.use("/api/groups", groupRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/planner", plannerRoutes);

app.use((err, req, res, next) => {
    console.error("ERROR CAUGHT IN MIDDLEWARE:", err);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
});

export default app;