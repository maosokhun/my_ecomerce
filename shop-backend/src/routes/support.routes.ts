import { Router } from 'express';
import { createSupportInquiry, listSupportInquiries } from '../controllers/support.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/inquiries', createSupportInquiry);
router.get('/inquiries', authenticate, requireAdmin, listSupportInquiries);

export default router;
