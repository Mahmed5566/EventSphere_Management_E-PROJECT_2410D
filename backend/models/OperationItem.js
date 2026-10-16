import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
  type: { type: String, enum: ['task','incident','announcement'], default: 'task' },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
  status: { type: String, enum: ['open','in-progress','resolved'], default: 'open' },
  area: { type: String, default: 'General' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

schema.index({ expo: 1, type: 1, status: 1, createdAt: -1 });
export default mongoose.model('OperationItem', schema);
