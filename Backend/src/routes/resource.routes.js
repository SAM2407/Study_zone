import { Router } from "express";
import {
    uploadResource,
    getResources,
    deleteResource,
    getUserGroups,
    proxyPdf          // ✅ add this
} from "../controllers/resource.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../utils/cloudinary.js";

const router = Router();

router.post("/upload", verifyJWT, upload.single("file"), uploadResource);
router.get("/", verifyJWT, getResources);
router.delete("/:resourceId", verifyJWT, deleteResource);
router.get("/my-groups", verifyJWT, getUserGroups);
router.get("/view/:resourceId", verifyJWT, proxyPdf);  // Auth handled by middleware (header or query param)

export default router;