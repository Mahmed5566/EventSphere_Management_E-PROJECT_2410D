import mongoose from 'mongoose';

// Records every provider payment event we have already processed, so a replayed
// or duplicated webhook can never credit inventory or settle an order twice.
// The provider's own event id is the idempotency key.
const schema = new mongoose.Schema({
  provider: { type: String, required: true, index: true },
  eventId: { type: String, required: true, unique: true },
  type: { type: String, default: '' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketOrder', default: null },
  livemode: { type: Boolean, default: false },
  // Set true while processing and flipped to true only after the side effects
  // (stock credit, order settlement) commit, so a crash mid-handling can be
  // retried by the provider instead of being silently dropped.
  processed: { type: Boolean, default: false },
  payload: { type: Object, default: {} },
}, { timestamps: true });

export default mongoose.model('PaymentEvent', schema);
