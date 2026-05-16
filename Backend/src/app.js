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
app.use(
    cors({
        origin:process.env.CROS_ORIGIN ||"*",
        credentials:true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
);
 
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