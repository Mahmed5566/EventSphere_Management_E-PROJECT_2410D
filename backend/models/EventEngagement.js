import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['checkin','session','booth','feedback','networking'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

schema.index({ expo: 1, user: 1, type: 1, targetId: 1 });
export default mongoose.model('EventEngagement', schema);
