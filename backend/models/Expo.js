import mongoose from "mongoose";

const expoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  endDate: { type: Date },
  location: { type: String, required: true },
  description: { type: String, default: "" },
  theme: { type: String, default: "" },
  image: { type: String, default: "" },
  status: { type: String, enum: ["draft","published","completed","cancelled"], default: "draft" },
  processingReady: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

export default mongoose.model("Expo", expoSchema);
