import { Router } from "express";
import { getVideoFinds, toggleLike, incrementShare } from "../modules/customer/controllers/customerVideoController";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// Public route to get video finds
router.get("/", getVideoFinds);

// Like a video (Protected)
router.post("/:videoId/like", authenticate, requireUserType('Customer'), toggleLike);

// Increment share count (Public)
router.post("/:videoId/share", incrementShare);

export default router;
