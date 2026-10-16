import mongoose from "mongoose";

const boothSchema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: "Expo", required: true },
  boothNumber: { type: String, required: true },
  size: { type: String, default: "3x3" },
  category: { type: String, default: "Standard" },
  status: { type: String, enum: ["available","reserved","occupied"], default: "available" },
  exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  details: { type: String, default: "" },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  width: { type: Number, default: 1, min: 0.5, max: 60 },
  height: { type: Number, default: 1, min: 0.5, max: 60 },
  rotation: { type: Number, default: 0 }
}, { timestamps: true });

boothSchema.index({ expo: 1, boothNumber: 1 }, { unique: true });
export default mongoose.model("Booth", boothSchema);
