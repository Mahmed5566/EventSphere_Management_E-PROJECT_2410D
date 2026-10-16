import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
  exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true, trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  phone: { type: String, default: '' },
  company: { type: String, default: '' },
  source: { type: String, default: 'booth' },
  status: { type: String, enum: ['new','contacted','qualified','won','lost'], default: 'new' },
  notes: { type: String, default: '' },
  followUpAt: { type: Date, default: null }
}, { timestamps: true });

leadSchema.index({ expo: 1, exhibitor: 1, createdAt: -1 });
export default mongoose.model('Lead', leadSchema);
