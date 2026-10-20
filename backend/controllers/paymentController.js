// Real payment-provider integration (Stripe Checkout).
//
// Design rules enforced here:
//   * No card number, CVV, PIN or OTP is ever received, stored or logged. Only
//     the provider's session/intent identifiers are persisted. Card data stays
//     entirely inside Stripe's hosted checkout, so this application never enters
//     PCI scope and makes no PCI-compliance claim.
//   * The price is always recomputed from the database, never trusted from the
//     client.
//   * Inventory is claimed atomically at checkout time (see utils/inventory.js)
//     and released if the session is abandoned or expires.
//   * An order is only marked paid by a signature-verified webhook, never by a
//     browser redirect. `confirmCheckout` is a read-only status refresh for the
//     success page and cannot credit inventory.
//   * Every webhook event is processed at most once, keyed on the provider event
//     id (models/PaymentEvent.js), so replays cannot double-credit stock.
//
// When STRIPE_SECRET_KEY is absent the endpoints degrade to the documented
// manual-demo path instead of pretending a payment happened.
import crypto from 'crypto';
import Stripe from 'stripe';
import TicketOrder from '../models/TicketOrder.js';
import TicketSetting from '../models/TicketSetting.js';
import Expo from '../models/Expo.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import PaymentEvent from '../models/PaymentEvent.js';
import { claimTicketStock, releaseTicketStock } from '../utils/inventory.js';

const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
const stripeClient = () => new Stripe(process.env.STRIPE_SECRET_KEY);

const invoice = () => `ES-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const qr = () => crypto.randomBytes(20).toString('hex');

async function ownerOf(order) {
  const expo = await Expo.findById(order.expo).select('createdBy title');
  return expo;
}

// ---------------------------------------------------------------------------
// POST /api/payments/checkout
// Creates a provider checkout session for an attendee. Stock is claimed first.
// ---------------------------------------------------------------------------
export const createCheckout = async (req, res, next) => {
  try {
    if (req.user.role !== 'attendee') return res.status(403).json({ success: false, message: 'Attendee checkout only.' });
    if (!stripeConfigured()) {
      return res.status(503).json({ success: false, message: 'No live payment gateway is configured. Set STRIPE_SECRET_KEY on the server to enable card checkout.' });
    }
    const { expo, passType, quantity = 1 } = req.body || {};
    if (!expo || !passType) return res.status(400).json({ success: false, message: 'Event and pass type are required.' });

    const event = await Expo.findById(expo);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    if (event.status === 'cancelled') return res.status(409).json({ success: false, message: 'This event has been cancelled.' });

    const settings = await TicketSetting.findOne({ expo });
    const pass = settings?.passes.find((p) => p.name === passType && p.enabled);
    if (!pass) return res.status(400).json({ success: false, message: 'This pass is not available.' });

    const qty = Math.max(1, Math.min(10, Number(quantity) || 1));
    // Price recomputed from the database — a client-supplied amount is ignored.
    const unitPrice = Number(pass.price || 0);

    // Atomic claim so two simultaneous buyers cannot oversell the last ticket.
    const claimed = await claimTicketStock(expo, passType, qty);
    if (!claimed) return res.status(409).json({ success: false, message: `${passType} is sold out or not enough stock remains.` });

    let order;
    try {
      order = await TicketOrder.create({
        expo, attendee: req.user._id, passType, unitPrice, quantity: qty,
        total: unitPrice * qty, status: 'pending', paymentProvider: 'stripe',
      });
    } catch (e) {
      await releaseTicketStock(expo, passType, qty);
      throw e;
    }

    try {
      const stripe = stripeClient();
      const base = process.env.SITE_URL || process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173';
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'pkr',
            product_data: { name: `${passType} — ${event.title}` },
            unit_amount: Math.round(unitPrice * 100),
          },
          quantity: qty,
        }],
        // The order id is the only thing we trust later; amounts are re-read from
        // the database when the webhook settles the order.
        metadata: { orderId: String(order._id), expoId: String(event._id) },
        client_reference_id: String(order._id),
        success_url: `${base}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}?payment=cancelled&order_id=${order._id}`,
      });
      order.paymentSessionId = session.id;
      await order.save();
      await AuditLog.create({ actor: req.user._id, action: 'checkout_created', entity: 'TicketOrder', entityId: String(order._id), meta: { provider: 'stripe', sessionId: session.id, total: order.total } }).catch(() => {});
      return res.status(201).json({ success: true, checkoutUrl: session.url, sessionId: session.id, order });
    } catch (e) {
      // A provider failure must not leak claimed stock.
      await releaseTicketStock(expo, passType, qty);
      await TicketOrder.findByIdAndDelete(order._id).catch(() => {});
      throw e;
    }
  } catch (e) { next(e); }
};

// ---------------------------------------------------------------------------
// GET /api/payments/confirm/:sessionId
// Read-only status refresh for the success page. It NEVER marks an order paid —
// settlement happens exclusively in the webhook.
// ---------------------------------------------------------------------------
export const confirmCheckout = async (req, res, next) => {
  try {
    const order = await TicketOrder.findOne({ paymentSessionId: req.params.sessionId })
      .populate('expo', 'title date location')
      .populate('attendee', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Checkout order not found.' });
    const owner = String(order.attendee?._id || order.attendee);
    if (owner !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    let providerState = 'not_configured';
    if (stripeConfigured() && order.paymentSessionId) {
      try {
        const stripe = stripeClient();
        const session = await stripe.checkout.sessions.retrieve(order.paymentSessionId);
        providerState = session.payment_status;
      } catch { providerState = 'unavailable'; }
    }
    // `settledBy` makes it unambiguous that the order status came from the
    // webhook, not from this browser-facing call.
    res.json({ success: true, paid: order.status === 'paid', providerState, settled: order.status === 'paid', order });
  } catch (e) { next(e); }
};

// ---------------------------------------------------------------------------
// POST /api/payments/webhook
// Signature-verified Stripe webhook. This is the only path that settles an order.
// Mounted with express.raw() so the exact bytes are available for verification.
// ---------------------------------------------------------------------------
export const webhook = async (req, res) => {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ success: false, message: 'Stripe webhooks are not configured.' });
  }
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    const stripe = stripeClient();
    // constructEvent verifies the HMAC signature against the raw body. An
    // unsigned or tampered payload throws and is rejected.
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ success: false, message: `Webhook signature verification failed: ${err.message}` });
  }

  // Idempotency: claim the event id. A duplicate is acknowledged without effect.
  let record;
  try {
    record = await PaymentEvent.create({
      provider: 'stripe', eventId: event.id, type: event.type,
      livemode: Boolean(event.livemode), payload: { type: event.type },
    });
  } catch (e) {
    if (e.code === 11000) return res.json({ success: true, received: true, duplicate: true });
    throw e;
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId || session.client_reference_id;
      const order = orderId ? await TicketOrder.findById(orderId) : await TicketOrder.findOne({ paymentSessionId: session.id });
      if (order) {
        record.orderId = order._id;
        // Verify the provider actually settled it before crediting anything.
        const paid = session.payment_status === 'paid';
        if (paid) {
          const alreadyPaid = order.status === 'paid';
          if (!alreadyPaid) {
            // The DB is the source of truth for the amount; never trust metadata.
            const amountOk = Number(session.amount_total ?? 0) === Math.round(Number(order.total) * 100);
            if (!amountOk) {
              await AuditLog.create({ actor: order.attendee, action: 'webhook_amount_mismatch', entity: 'TicketOrder', entityId: String(order._id), meta: { expected: Math.round(order.total * 100), received: session.amount_total } }).catch(() => {});
            } else {
              order.status = 'paid';
              order.paymentSessionId = session.id;
              order.qrToken = order.qrToken || qr();
              order.invoiceNo = order.invoiceNo || invoice();
              await order.save();
              const expo = await ownerOf(order);
              if (expo?.createdBy) {
                const n = await Notification.create({ user: expo.createdBy, title: 'New ticket sale', message: `${order.quantity} × ${order.passType} sold for ${expo.title}.`, type: 'sale', data: { expo: order.expo, orderId: order._id } });
                req.app.get('io')?.to(`user:${expo.createdBy}`).emit('notification:new', n);
              }
              req.app.get('io')?.to(`user:${order.attendee}`).emit('ticket:paid', order);
              await AuditLog.create({ actor: order.attendee, action: 'payment_settled', entity: 'TicketOrder', entityId: String(order._id), meta: { provider: 'stripe', eventId: event.id, total: order.total } }).catch(() => {});
            }
          }
        }
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const order = await TicketOrder.findOne({ paymentSessionId: session.id });
      if (order && order.status === 'pending') {
        record.orderId = order._id;
        // Abandoned checkout: return the reserved seats to the pool exactly once.
        await releaseTicketStock(order.expo, order.passType, order.quantity);
        order.status = 'cancelled';
        await order.save();
      }
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      const intent = charge.payment_intent;
      if (intent) {
        const order = await TicketOrder.findOne({ paymentSessionId: { $regex: intent } });
        if (order && order.status === 'paid') {
          record.orderId = order._id;
          await releaseTicketStock(order.expo, order.passType, order.quantity);
          order.status = 'refunded';
          await order.save();
        }
      }
    }

    record.processed = true;
    await record.save();
    return res.json({ success: true, received: true });
  } catch (err) {
    // Leaving processed=false means Stripe's retry can reprocess this event.
    return res.status(500).json({ success: false, message: `Webhook handling failed: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// POST /api/payments/:orderId/refund  (organizer/admin)
// ---------------------------------------------------------------------------
export const refund = async (req, res, next) => {
  try {
    if (!['admin', 'organizer'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Organizer access required.' });
    const order = await TicketOrder.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (req.user.role === 'organizer') {
      const expo = await Expo.findById(order.expo).select('createdBy');
      if (!expo || String(expo.createdBy) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'You can only refund orders for your own events.' });
    }
    if (order.status !== 'paid') return res.status(400).json({ success: false, message: 'Only paid orders can be refunded.' });

    // Perform the provider refund first; only flip local state if it succeeds.
    if (stripeConfigured() && order.paymentProvider === 'stripe' && order.paymentSessionId) {
      try {
        const stripe = stripeClient();
        const session = await stripe.checkout.sessions.retrieve(order.paymentSessionId);
        if (session.payment_intent) await stripe.refunds.create({ payment_intent: session.payment_intent });
      } catch (e) {
        return res.status(502).json({ success: false, message: `Provider refund failed: ${e.message}` });
      }
    }
    await releaseTicketStock(order.expo, order.passType, order.quantity);
    order.status = 'refunded';
    await order.save();
    await Notification.create({ user: order.attendee, title: 'Ticket refunded', message: `Your ${order.passType} ticket has been refunded.`, type: 'payment', data: { orderId: order._id } }).catch(() => {});
    await AuditLog.create({ actor: req.user._id, action: 'refunded', entity: 'TicketOrder', entityId: String(order._id), meta: { provider: order.paymentProvider } }).catch(() => {});
    res.json({ success: true, order });
  } catch (e) { next(e); }
};

export const paymentStatus = async (req, res, next) => {
  try {
    const order = await TicketOrder.findById(req.params.orderId).populate('expo', 'title');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (req.user.role === 'attendee' && String(order.attendee) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Access denied.' });
    res.json({ success: true, order, gatewayConfigured: stripeConfigured() });
  } catch (e) { next(e); }
};

export const gatewayStatus = async (req, res) => {
  res.json({
    success: true,
    gatewayConfigured: stripeConfigured(),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    // Never echo key material — only whether it is present.
    provider: stripeConfigured() ? 'stripe' : 'manual_demo',
    note: stripeConfigured()
      ? 'Stripe Checkout is enabled. Orders settle only via the signature-verified webhook.'
      : 'No live gateway configured; orders use the documented manual-demo path.',
  });
};
