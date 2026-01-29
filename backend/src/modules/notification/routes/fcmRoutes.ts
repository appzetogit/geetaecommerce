import express from 'express';
import { saveFCMToken, sendNotification } from '../controllers/fcmController';
import { authenticate } from '../../../middleware/auth';

const router = express.Router();

router.post('/save-token', authenticate, saveFCMToken);
router.post('/send', sendNotification); // Made public for testing

export default router;
