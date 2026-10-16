import {Router} from 'express';import {protect,authorize} from '../middleware/auth.js';import {createOrder,mine,all,cancel,requestCancellation,submitCancelRequest,verifyTicket,checkInTicket} from '../controllers/ticketOrderController.js';const r=Router();r.post('/',protect,authorize('attendee'),createOrder);r.get('/mine',protect,authorize('attendee'),mine);r.get('/',protect,authorize('admin','organizer'),all);r.put('/:id/cancel',protect,cancel);
r.post('/:id/cancel-request',protect,authorize('attendee'),submitCancelRequest);
r.post('/:id/cancel-direct',protect,authorize('attendee'),requestCancellation);
r.get('/verify/:token',protect,authorize('admin','organizer'),verifyTicket);
r.post('/check-in/:token',protect,authorize('admin','organizer','staff'),checkInTicket);export default r;
