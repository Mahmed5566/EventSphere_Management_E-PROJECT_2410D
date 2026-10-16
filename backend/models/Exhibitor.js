import mongoose from "mongoose";

const exhibitorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  companyName: { type: String, required: true },
  description: { type: String, default: "" },
  products: [{ type: String }],
  services: [{ type: String }],
  logo: { type: String, default: "" },
  website: { type: String, default: "" },
  phone: { type: String, default: "" },
  documents: [{ type: String }],
  approved: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Exhibitor", exhibitorSchema);
