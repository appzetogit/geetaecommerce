import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import * as attributeController from "../modules/admin/controllers/adminAttributeController";

const router = Router();

// All routes require authentication and Seller role
router.use(authenticate);
router.use(requireUserType("Seller"));

router.get("/", attributeController.getAttributes);
router.post("/", attributeController.createAttribute);
router.put("/:id", attributeController.updateAttribute);
router.delete("/:id", attributeController.deleteAttribute);

export default router;
