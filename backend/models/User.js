import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: {
    type: String,
    enum: ["admin", "organizer", "exhibitor", "attendee", "staff"],
    default: "attendee"
  },
  phone: { type: String, default: "" },
  company: { type: String, default: "" },
  avatar: { type: String, default: "" },
  cover: { type: String, default: "" },
  language: { type: String, enum: ["en", "ur"], default: "en" },
  jobTitle: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  bio: { type: String, default: "" },
  interests: { type: String, default: "" },
  sessionVersion: { type: Number, default: 0 },
  organizerKey: { type: String, unique: true, sparse: true },
  customFields: { type: [mongoose.Schema.Types.Mixed], default: [] },
  resetToken: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false }
}, { timestamps: true });

userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("User", userSchema);
