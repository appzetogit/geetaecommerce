import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import * as variationTypeController from "../modules/admin/controllers/adminVariationTypeController";

const router = Router();

// All routes require authentication and Admin role
router.use(authenticate);
router.use(requireUserType("Admin"));

router.get("/", variationTypeController.getVariationTypes);
router.post("/", variationTypeController.createVariationType);
router.put("/:id", variationTypeController.updateVariationType);
router.delete("/:id", variationTypeController.deleteVariationType);

export default router;
