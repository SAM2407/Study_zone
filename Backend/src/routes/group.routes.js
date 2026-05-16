import { Router } from "express"

import {
createGroup,
getPublicGroups,
joinGroup,
getMyGroups,
leaveGroup,
getGroupMembers,
kickMember
} from "../controllers/group.controllers.js"

import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.post("/create",verifyJWT,createGroup)

router.get("/public",getPublicGroups)

router.post("/join/:groupId",verifyJWT,joinGroup)

router.get("/my-groups", verifyJWT, getMyGroups);

router.post("/leave/:groupId", verifyJWT, leaveGroup);

router.get("/members/:groupId", verifyJWT, getGroupMembers);

router.post("/kick/:groupId/:memberId", verifyJWT, kickMember);

export default router;