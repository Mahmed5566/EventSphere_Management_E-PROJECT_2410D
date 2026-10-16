import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: "Expo", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["attendee","exhibitor"], required: true },
  status: { type: String, enum: ["pending","approved","rejected"], default: "pending" }
}, { timestamps: true });

registrationSchema.index({ expo: 1, user: 1 }, { unique: true });
export default mongoose.model("ExpoRegistration", registrationSchema);
