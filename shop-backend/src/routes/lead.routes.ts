import { Router } from 'express';
import { createLead, listLeads } from '../controllers/lead.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/subscribe', createLead);
router.get('/', authenticate, requireAdmin, listLeads);

export default router;
