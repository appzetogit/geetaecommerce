import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import * as variationTypeController from "../modules/seller/controllers/sellerVariationTypeController";

const router = Router();

// All routes require authentication and Seller role
router.use(authenticate);
router.use(requireUserType("Seller"));

router.get("/", variationTypeController.getVariationTypes);
router.post("/", variationTypeController.createVariationType);
router.put("/:id", variationTypeController.updateVariationType);
router.delete("/:id", variationTypeController.deleteVariationType);

export default router;
