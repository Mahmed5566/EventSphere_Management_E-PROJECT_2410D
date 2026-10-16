import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expo: { type: mongoose.Schema.Types.ObjectId, ref: "Expo" },
  rating: { type: Number, min: 1, max: 5 },
  message: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model("Feedback", feedbackSchema);
