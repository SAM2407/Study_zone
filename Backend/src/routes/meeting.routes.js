import { Router } from "express";
import {
    createMeetingRoom,
    getMeetingDetails,
    endMeetingRoom
} from "../controllers/meeting.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// create a new room
router.post("/create", verifyJWT, createMeetingRoom);

// get meeting details and verify access
router.get("/:meetingId", verifyJWT, getMeetingDetails);

// end/delete a room
router.delete("/end/:roomName", verifyJWT, endMeetingRoom);

export default router;