import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  validateGlobalTheme,
  validateCustomerTheme,
} from "../middleware/validateTheme";
import {
  getTheme,
  getFullThemeSettings,
  updateGlobalTheme,
  updateCustomerTheme,
  resetTheme,
  importTheme,
  restoreThemeFromHistory,
  updateDarkMode,
} from "../modules/admin/controllers/adminThemeController";

const router = Router();

// ─── Public endpoint: Anyone can fetch the theme ───
router.get("/", getTheme);

// ─── Admin-only endpoints ───
router.get(
  "/admin",
  authenticate,
  requireUserType("Admin"),
  getFullThemeSettings
);

router.put(
  "/global",
  authenticate,
  requireUserType("Admin"),
  validateGlobalTheme,
  updateGlobalTheme
);

router.put(
  "/customer",
  authenticate,
  requireUserType("Admin"),
  validateCustomerTheme,
  updateCustomerTheme
);

router.post(
  "/reset",
  authenticate,
  requireUserType("Admin"),
  resetTheme
);

router.post(
  "/import",
  authenticate,
  requireUserType("Admin"),
  importTheme
);

router.post(
  "/restore/:index",
  authenticate,
  requireUserType("Admin"),
  restoreThemeFromHistory
);

router.put(
  "/dark-mode",
  authenticate,
  requireUserType("Admin"),
  updateDarkMode
);

export default router;
