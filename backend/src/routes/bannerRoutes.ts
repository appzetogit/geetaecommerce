import { Router } from 'express';
import { getBanners, createBanner, updateBanner, deleteBanner } from '../controllers/bannerController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getBanners);

// Protected routes (Admin only)
router.use(authenticate);
router.use(requireUserType('Admin'));

router.post('/', createBanner);
router.put('/:id', updateBanner);
router.delete('/:id', deleteBanner);

export default router;
