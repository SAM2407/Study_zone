import dotenv from "dotenv";
import { createServer } from "http";
import connectDB from "./db/index.js";
import app from "./app.js";
import { initSocket } from "./socket.js";

dotenv.config();

connectDB()
.then(() => {
    // ✅ create http server from express app
    const server = createServer(app);

    // ✅ attach socket.io to the server
    initSocket(server);

    // ✅ listen on server NOT app
    server.listen(process.env.PORT || 5000, () => {
        console.log(`Server is running on port ${process.env.PORT || 5000}`);
    });
})
.catch((error) => {
    console.log("Database connection failed:", error);
    process.exit(1);
});