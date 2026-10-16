import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import expoRoutes from "./routes/expoRoutes.js";
import boothRoutes from "./routes/boothRoutes.js";
import exhibitorRoutes from "./routes/exhibitorRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";

import ticketOrderRoutes from "./routes/ticketOrderRoutes.js";

import venueRoutes from "./routes/venueRoutes.js";
import ticketSettingRoutes from "./routes/ticketSettingRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import exhibitorApplicationRoutes from "./routes/exhibitorApplicationRoutes.js";
import advancedRoutes from "./routes/advancedRoutes.js";
import enterpriseRoutes from "./routes/enterpriseRoutes.js";
import experienceRoutes from "./routes/experienceRoutes.js";
import checkinRoutes from "./routes/checkinRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import copilotRoutes from "./routes/copilotRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";


dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }
});
app.set("io", io);

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "6mb" }));
app.use(cookieParser());

app.get("/", (req, res) => res.json({ success: true, message: "EventSphere Backend is running 🚀", version: "1.0.0" }));
app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    database: databaseConnected ? "connected" : "disconnected",
    status: databaseConnected ? "OK" : "WAITING_FOR_DATABASE",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/expos", expoRoutes);
app.use("/api/booths", boothRoutes);
app.use("/api/exhibitors", exhibitorRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/ticket-orders", ticketOrderRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/ticket-settings", ticketSettingRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/exhibitor-applications", exhibitorApplicationRoutes);
app.use("/api/advanced", advancedRoutes);
app.use("/api/enterprise", enterpriseRoutes);
app.use("/api/experience", experienceRoutes);
app.use("/api/checkin", checkinRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/copilot", copilotRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/tasks", taskRoutes);

// --- Socket.IO: authenticated rooms -----------------------------------------
// A client may only join the private room of the identity proven by its JWT.
// The previously unauthenticated `user:join` handler let any client subscribe
// to any other user's notifications, so it is now gated on a verified token.
io.use((socket, next) => {
  const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
  if (!token) return next(); // anonymous connections may still join public expo rooms
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = String(decoded.id);
  } catch {
    /* invalid token -> stay anonymous */
  }
  next();
});

io.on("connection", (socket) => {
  console.log("Realtime client connected:", socket.id);

  // Auto-join the verified user's private room so missed notifications are
  // delivered immediately without trusting a client-supplied id.
  if (socket.data.userId) socket.join(`user:${socket.data.userId}`);

  socket.on("user:join", (id) => {
    // Only allow joining your own verified room.
    if (socket.data.userId && String(id) === socket.data.userId) socket.join(`user:${socket.data.userId}`);
  });
  socket.on("expo:join", (id) => id && socket.join(`expo:${id}`));
  socket.on("expo:leave", (id) => id && socket.leave(`expo:${id}`));
  socket.on("disconnect", () => console.log("Realtime client disconnected:", socket.id));
});

app.use((req, res) => res.status(404).json({ success: false, message: "API route not found." }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
});

const PORT = process.env.PORT || 5000;

// Start the API even if MongoDB is temporarily unavailable. This lets the
// frontend load while the database service is being started; database-backed
// API calls will work once the connection succeeds.
httpServer.listen(PORT, () => {
  console.log(`EventSphere Server running at http://localhost:${PORT}`);
  console.log(`Realtime Socket.IO running on the same server`);
  connectWithRetry();
});

async function connectWithRetry() {
  try {
    await connectDB();
  } catch (error) {
    console.error(`MongoDB is not connected yet: ${error.message}`);
    console.error('Check that MongoDB Community Server is running, or set backend/.env MONGO_URI to a valid Atlas URI.');
    console.error('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
}
