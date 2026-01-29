
import { Router } from 'express';
import { getProductReviews, addReview } from '../modules/customer/controllers/productReviewController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public route to view reviews
router.get('/:productId', getProductReviews);

// Protected route to add review
router.post('/', authenticate, addReview);

export default router;
