import { Router } from 'express';
import { getFlashDeals, updateFlashDeals } from '../controllers/bannerController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

// Public route to get flash deals
router.get('/', getFlashDeals);

// Protected routes (Admin only) to update flash deals
router.put('/', authenticate, requireUserType('Admin'), updateFlashDeals);

export default router;
