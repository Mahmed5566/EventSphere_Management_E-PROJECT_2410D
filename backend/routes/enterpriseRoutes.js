import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import * as c from '../controllers/enterpriseController.js';
const r=Router();
r.get('/search',protect,c.search);
r.get('/events/:id/detail',protect,c.eventDetail);
r.get('/reports',protect,authorize('admin','organizer'),c.reports);
r.put('/registrations/:id/status',protect,authorize('admin','organizer'),c.registrationStatus);
r.get('/leads',protect,c.leads); r.post('/leads',protect,authorize('admin','organizer','exhibitor'),c.leadCreate); r.put('/leads/:id',protect,authorize('admin','organizer','exhibitor'),c.leadUpdate);
r.get('/email-templates',protect,authorize('admin','organizer'),c.templates); r.post('/email-templates',protect,authorize('admin','organizer'),c.templateCreate); r.put('/email-templates/:id',protect,authorize('admin','organizer'),c.templateUpdate); r.delete('/email-templates/:id',protect,authorize('admin','organizer'),c.templateDelete);
r.get('/calendar',protect,c.calendar);
r.get('/notifications',protect,c.notifications); r.post('/notifications',protect,authorize('admin','organizer'),c.notificationCreate);
// Payment endpoints live in their own hardened router (/api/payments) so the
// Stripe webhook can receive a raw body. See routes/paymentRoutes.js.
export default r;
