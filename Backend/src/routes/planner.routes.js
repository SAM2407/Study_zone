import { Router } from "express"

import {
createTask,
getUserTasks,
getPlannerTasks,
updateTask,
deleteTask
} from "../controllers/planner.controllers.js"

import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.post("/task",verifyJWT,createTask)
router.put("/task/:id",verifyJWT,updateTask)
router.delete("/task/:id",verifyJWT,deleteTask)

router.get("/", verifyJWT, getPlannerTasks);

export default router