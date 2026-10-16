import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: "Expo", required: true },
  title: { type: String, required: true },
  topic: { type: String, default: "" },
  speaker: { type: String, default: "" },
  location: { type: String, default: "" },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  capacity: { type: Number, default: 100 },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true });

export default mongoose.model("Session", sessionSchema);
