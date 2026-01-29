import { Router } from 'express';
import { getFreeGiftRules } from '../modules/admin/controllers/adminFreeGiftController';

const router = Router();

// Public route to get active free gift rules (or all, filtering happens in frontend or controller can be modified)
// For customer, we typically want Active only.
// But the current controller returns all.
// Let's create a specific customer controller method wrapper if needed, or just use the admin one and filter in frontend for now,
// or better: modify controller to support filtering.

router.get('/', getFreeGiftRules);

export default router;
