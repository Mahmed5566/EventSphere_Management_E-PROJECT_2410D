import mongoose from "mongoose";

// Team task. Assignable to a real User (existing identity system) and linked
// to an Event. Status is a simple To Do -> In Progress -> Completed flow.
const taskSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: "Expo", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 4000 },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    status: { type: String, enum: ["todo", "in-progress", "completed"], default: "todo" },
    dueDate: { type: Date, default: null },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date, default: null },
    tags: [{ type: String, trim: true, maxlength: 40 }],
  },
  { timestamps: true }
);

taskSchema.index({ expo: 1, status: 1, dueDate: 1 });
taskSchema.index({ expo: 1, assignee: 1, status: 1 });
taskSchema.index({ title: "text", description: "text" });

export default mongoose.model("Task", taskSchema);
