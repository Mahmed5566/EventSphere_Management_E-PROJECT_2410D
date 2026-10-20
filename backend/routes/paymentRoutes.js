import { Router } from 'express';
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { createCheckout, confirmCheckout, webhook, refund, paymentStatus, gatewayStatus } from '../controllers/paymentController.js';

const r = Router();

// The webhook needs the RAW request body for HMAC signature verification, so it
// must be registered here with express.raw() and mounted BEFORE express.json()
// in server.js. Applying express.json() first would consume the stream and make
// verification impossible.
r.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// Everything else is normal authenticated JSON.
r.get('/status', gatewayStatus);
r.post('/checkout', protect, authorize('attendee'), createCheckout);
r.get('/confirm/:sessionId', protect, confirmCheckout);
r.get('/:orderId', protect, paymentStatus);
r.post('/:orderId/refund', protect, authorize('admin', 'organizer'), refund);

export default r;
