/**
 * EventSphere demo seed.
 *
 * Populates a local MongoDB database with realistic data so every dashboard
 * section and all seven modules (analytics/reports, QR check-in, activity feed,
 * calendar, AI copilot, 3D booth designer, budget & team tasks) have something
 * real to render.
 *
 * Run:   npm run seed            (no events in DB -> seeds directly)
 *        npm run seed -- --force (wipes existing event data first)
 *
 * Every demo account created here shares the password: Password123
 * User accounts are NEVER deleted. An existing organizer account is reused so
 * seeded events belong to the real organizer already registered. Event data is
 * only wiped when --force is passed, so this can never silently destroy real
 * events.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import crypto from "crypto";

import User from "./models/User.js";
import Venue from "./models/Venue.js";
import Expo from "./models/Expo.js";
import Booth from "./models/Booth.js";
import Exhibitor from "./models/Exhibitor.js";
import Session from "./models/Session.js";
import Speaker from "./models/Speaker.js";
import Sponsor from "./models/Sponsor.js";
import Staff from "./models/Staff.js";
import TicketSetting from "./models/TicketSetting.js";
import TicketOrder from "./models/TicketOrder.js";
import CheckIn from "./models/CheckIn.js";
import Notification from "./models/Notification.js";
import Activity from "./models/Activity.js";
import FinanceTransaction from "./models/FinanceTransaction.js";
import Task from "./models/Task.js";
import Lead from "./models/Lead.js";
import EventEngagement from "./models/EventEngagement.js";
import OperationItem from "./models/OperationItem.js";
import Feedback from "./models/Feedback.js";
import Message from "./models/Message.js";
import Campaign from "./models/Campaign.js";
import EmailTemplate from "./models/EmailTemplate.js";
import Membership from "./models/Membership.js";
import ExpoRegistration from "./models/ExpoRegistration.js";
import ExhibitorApplication from "./models/ExhibitorApplication.js";
import AuditLog from "./models/AuditLog.js";

dotenv.config();

const PASSWORD = "Password123";
const FORCE = process.argv.includes("--force");
const DAY = 24 * 60 * 60 * 1000;

const now = new Date();
const at = (dayOffset, hours = 10, minutes = 0) => {
  const d = new Date(now.getTime() + dayOffset * DAY);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

let invoiceSeq = 0;
const nextInvoice = () => `INV-${now.getFullYear()}-${String(++invoiceSeq).padStart(4, "0")}`;
const qrToken = () => crypto.randomBytes(16).toString("hex");
const pick = (arr, i) => arr[i % arr.length];

// Event-data collections this script owns. User accounts are never wiped.
const EVENT_MODELS = [
  AuditLog, Message, Campaign, EmailTemplate, Membership, ExpoRegistration,
  ExhibitorApplication, Feedback, OperationItem, EventEngagement, Lead, Task,
  FinanceTransaction, Activity, Notification, CheckIn, TicketOrder, TicketSetting,
  Staff, Sponsor, Speaker, Session, Exhibitor, Booth, Expo, Venue,
];

async function wipeEventData() {
  // Delete leaf/dependent collections before parents.
  for (const model of EVENT_MODELS) {
    await model.deleteMany({});
  }
  console.log("Cleared existing event data.");
}

// Reuse an account if the email already exists, otherwise create one (which
// hashes the password through the User pre-save hook).
async function ensureUser(data) {
  const email = String(data.email).trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ ...data, email });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const existingExpos = await Expo.countDocuments();

  if (!FORCE && existingExpos > 0) {
    console.log("\nDatabase already contains events — nothing was changed.");
    console.log("To wipe the seeded event data and reseed, run:  npm run seed -- --force\n");
    await mongoose.disconnect();
    return;
  }

  await wipeEventData();

  // ---------------------------------------------------------------------------
  // Users (accounts are reused, never deleted)
  // ---------------------------------------------------------------------------
  const admin = await ensureUser({ name: "Ayesha Khan", email: "admin@eventsphere.demo", password: PASSWORD, role: "admin", company: "EventSphere", jobTitle: "Platform Administrator", location: "Lahore, PK", phone: "+92 300 0000001", bio: "Runs the EventSphere control room." });

  // Reuse the organizer already registered by the user, if one exists.
  let organizer = await User.findOne({ role: "organizer" });
  if (!organizer) {
    organizer = await ensureUser({ name: "Bilal Ahmed", email: "organizer@eventsphere.demo", password: PASSWORD, role: "organizer", organizerKey: "primary", company: "Momentum Events", jobTitle: "Lead Event Organizer", location: "Karachi, PK", phone: "+92 300 0000002", website: "https://momentum.example.com", bio: "Organizes large-scale technology and business expos." });
  }

  const staffUser = await ensureUser({ name: "Sana Malik", email: "staff@eventsphere.demo", password: PASSWORD, role: "staff", company: "Momentum Events", jobTitle: "Floor Operations", location: "Lahore, PK", phone: "+92 300 0000003" });
  const exhibitorUser1 = await ensureUser({ name: "Hamza Sheikh", email: "exhibitor@eventsphere.demo", password: PASSWORD, role: "exhibitor", company: "Quantum Robotics", jobTitle: "Head of Growth", location: "Islamabad, PK", phone: "+92 300 0000004" });
  const exhibitorUser2 = await ensureUser({ name: "Mariam Iqbal", email: "exhibitor2@eventsphere.demo", password: PASSWORD, role: "exhibitor", company: "Nimbus Cloud", jobTitle: "Partnerships", location: "Lahore, PK", phone: "+92 300 0000005" });

  const attendeeSeeds = [
    { name: "Usman Tariq", email: "attendee@eventsphere.demo", company: "Freelance", jobTitle: "Product Designer", location: "Lahore, PK", phone: "+92 300 0000006" },
    { name: "Fatima Noor", email: "attendee2@eventsphere.demo", company: "Retail Co.", jobTitle: "Marketing Lead", location: "Karachi, PK" },
    { name: "Zain Abbas", email: "attendee3@eventsphere.demo", company: "Startup Hub", jobTitle: "Founder", location: "Islamabad, PK" },
    { name: "Hina Raza", email: "attendee4@eventsphere.demo", company: "DataWorks", jobTitle: "Data Scientist", location: "Lahore, PK" },
    { name: "Omar Farooq", email: "attendee5@eventsphere.demo", company: "CloudBridge", jobTitle: "Solutions Architect", location: "Lahore, PK" },
    { name: "Rabia Aslam", email: "attendee6@eventsphere.demo", company: "FinEdge", jobTitle: "Analyst" },
    { name: "Kashif Ali", email: "attendee7@eventsphere.demo", company: "NextByte", jobTitle: "Engineer" },
  ];
  const allAttendees = [];
  for (const seed of attendeeSeeds) {
    allAttendees.push(await ensureUser({ ...seed, password: PASSWORD, role: "attendee" }));
  }
  console.log(`Users: ${await User.countDocuments()} (organizer: ${organizer.email})`);

  // ---------------------------------------------------------------------------
  // Membership (organizer plan)
  // ---------------------------------------------------------------------------
  await Membership.create({
    user: organizer._id,
    plan: "pro",
    status: "active",
    trialEndsAt: at(30, 12),
    messageLimit: 1000,
    priority: 3,
  });

  // ---------------------------------------------------------------------------
  // Venues
  // ---------------------------------------------------------------------------
  const [venue1, venue2, venue3] = await Venue.create([
    { name: "Lahore Expo Centre", type: "convention_center", city: "Lahore", address: "Johar Town, Lahore", capacity: 12000, description: "Flagship convention venue with three halls and a 3D-mapped floor.", membershipPlan: "pro", owner: organizer._id, map: { width: 12, height: 8, zones: [{ name: "Hall A", x: 0, y: 0, width: 6, height: 4, color: "#2563eb" }, { name: "Hall B", x: 6, y: 0, width: 6, height: 4, color: "#06b6d4" }, { name: "Lounge", x: 0, y: 4, width: 12, height: 4, color: "#111827" }] } },
    { name: "Karachi Expo Center", type: "convention_center", city: "Karachi", address: "University Road, Karachi", capacity: 10000, description: "Large-scale venue for technology and trade shows.", membershipPlan: "growth", owner: organizer._id },
    { name: "Serena Hall", type: "hotel", city: "Islamabad", address: "Khayaban-e-Suharwardy, Islamabad", capacity: 2000, description: "Premium hotel ballroom for summits and conferences.", membershipPlan: "starter", owner: organizer._id },
  ]);

  // ---------------------------------------------------------------------------
  // Events (Expo)
  // ---------------------------------------------------------------------------
  const liveExpo = await Expo.create({
    title: "TechNova Expo 2026",
    date: at(-1, 9),
    endDate: at(2, 18),
    location: "Lahore Expo Centre",
    description: "Pakistan's flagship technology expo — robotics, AI, cloud and startups under one roof.",
    theme: "Innovation at Scale",
    image: "/eventspace-hero-visual.jpg",
    status: "published",
    processingReady: true,
    createdBy: organizer._id,
  });
  const upcomingExpo = await Expo.create({
    title: "Global Startup Summit",
    date: at(14, 9),
    endDate: at(16, 18),
    location: "Karachi Expo Center",
    description: "Founders, investors and operators sharing what actually works at scale.",
    theme: "Build. Raise. Scale.",
    image: "/eventspace-hero-visual.jpg",
    status: "published",
    processingReady: true,
    createdBy: organizer._id,
  });
  const completedExpo = await Expo.create({
    title: "Healthcare Innovation Forum",
    date: at(-45, 9),
    endDate: at(-43, 17),
    location: "Serena Hall, Islamabad",
    description: "A completed forum on digital health, diagnostics and connected care.",
    theme: "Connected Care",
    status: "completed",
    createdBy: organizer._id,
  });
  const draftExpo = await Expo.create({
    title: "Design Futures Conference",
    date: at(60, 9),
    endDate: at(61, 18),
    location: "Lahore Expo Centre",
    description: "Draft concept for a product and design leadership conference.",
    theme: "Designing Tomorrow",
    status: "draft",
    createdBy: organizer._id,
  });
  const expos = [liveExpo, upcomingExpo, completedExpo, draftExpo];
  console.log(`Events: ${expos.length}`);

  // ---------------------------------------------------------------------------
  // Exhibitors + exhibitor applications
  // ---------------------------------------------------------------------------
  const [exhibitor1, exhibitor2] = await Exhibitor.create([
    { user: exhibitorUser1._id, companyName: "Quantum Robotics", description: "Autonomous warehouse robots and industrial automation.", products: ["Warehouse AMR", "Vision Sensor Kit"], services: ["Integration", "Support"], website: "https://quantum-robotics.example.com", phone: "+92 42 1110001", approved: true },
    { user: exhibitorUser2._id, companyName: "Nimbus Cloud", description: "Managed cloud, observability and platform engineering.", products: ["Nimbus Platform"], services: ["Cloud migration", "DevOps"], website: "https://nimbus-cloud.example.com", phone: "+92 21 1110002", approved: true },
  ]);

  let applicationSeq = 0;
  const nextVoucher = () => `VCH-${now.getFullYear()}-${String(++applicationSeq).padStart(3, "0")}`;

  await ExhibitorApplication.create([
    { expo: liveExpo._id, user: exhibitorUser1._id, exhibitor: exhibitor1._id, companyName: "Quantum Robotics", status: "approved", paymentRequired: true, paymentStatus: "paid", amount: 250000, passType: "Business Pass", invoiceNo: "INV-APP-1001", voucherNo: nextVoucher(), appliedAt: at(-20, 11) },
    { expo: liveExpo._id, user: exhibitorUser2._id, exhibitor: exhibitor2._id, companyName: "Nimbus Cloud", status: "approved", paymentRequired: true, paymentStatus: "paid", amount: 180000, passType: "Business Pass", invoiceNo: "INV-APP-1002", voucherNo: nextVoucher(), appliedAt: at(-18, 14) },
  ]);

  // ---------------------------------------------------------------------------
  // Booths (3D floor plan + assignments)
  // ---------------------------------------------------------------------------
  const boothDocs = [];
  const categories = ["Standard", "Premium", "Startup Alley", "Sponsor"];
  const buildBooths = async (expo, count, occupiedPairs) => {
    const rows = ["A", "B", "C", "D"];
    for (let i = 0; i < count; i += 1) {
      const row = rows[Math.floor(i / 5) % rows.length];
      const num = (i % 5) + 1;
      const boothNumber = `${row}${num}`;
      const occupied = occupiedPairs[boothNumber];
      boothDocs.push({
        expo: expo._id,
        boothNumber,
        size: pick(["3x3", "3x6", "6x6"], i),
        category: pick(categories, i),
        status: occupied ? "occupied" : i % 4 === 0 ? "reserved" : "available",
        exhibitor: occupied || null,
        details: occupied ? `Assigned to ${occupied}.` : "",
        x: (i % 5) * 2.2,
        y: Math.floor(i / 5) * 2.2,
        width: 2,
        height: 2,
        rotation: 0,
      });
    }
  };
  await buildBooths(liveExpo, 20, { A1: exhibitorUser1._id, A2: exhibitorUser2._id });
  await buildBooths(upcomingExpo, 12, { A1: exhibitorUser1._id });
  await Booth.create(boothDocs);
  console.log(`Booths: ${boothDocs.length}`);

  // ---------------------------------------------------------------------------
  // Ticket settings
  // ---------------------------------------------------------------------------
  const priceTable = { "VIP Pass": 25000, "Pro Pass": 12000, "Business Pass": 6000, "Classic Pass": 2500 };
  const makePasses = (capacity) =>
    ["VIP Pass", "Pro Pass", "Business Pass", "Classic Pass"].map((name) => ({
      name,
      price: priceTable[name],
      capacity: Math.round(capacity / 4),
      sold: 0,
      enabled: true,
    }));
  for (const expo of [liveExpo, upcomingExpo, completedExpo]) {
    await TicketSetting.create({ expo: expo._id, passes: makePasses(400), createdBy: organizer._id });
  }

  // ---------------------------------------------------------------------------
  // Ticket orders + check-ins
  // ---------------------------------------------------------------------------
  const passTypes = ["VIP Pass", "Pro Pass", "Business Pass", "Classic Pass"];
  const ticketPlans = [
    { expo: liveExpo, count: 14, paidRatio: 0.8 },
    { expo: upcomingExpo, count: 8, paidRatio: 0.5 },
    { expo: completedExpo, count: 6, paidRatio: 1 },
  ];
  const paidTickets = [];
  let ticketIdx = 0;
  for (const plan of ticketPlans) {
    for (let i = 0; i < plan.count; i += 1) {
      const passType = pick(passTypes, ticketIdx);
      const attendee = pick(allAttendees, ticketIdx);
      const paid = i / plan.count < plan.paidRatio;
      const checkedIn = paid && plan.expo === completedExpo;
      const doc = await TicketOrder.create({
        expo: plan.expo._id,
        attendee: attendee._id,
        passType,
        unitPrice: priceTable[passType],
        quantity: 1,
        total: priceTable[passType],
        status: paid ? "paid" : "pending",
        paymentProvider: "manual_demo",
        paymentSessionId: paid ? `cs_demo_${ticketIdx}` : "",
        qrToken: paid ? qrToken() : undefined,
        invoiceNo: paid ? nextInvoice() : undefined,
        checkedInAt: checkedIn ? at(-40, 11 + (i % 6)) : null,
      });
      if (paid) paidTickets.push({ doc, checkedIn, expo: plan.expo });
      ticketIdx += 1;
    }
  }
  // Check in a slice of the live event's paid tickets too.
  for (const entry of paidTickets) {
    if (entry.expo === liveExpo) {
      const idx = paidTickets.indexOf(entry);
      if (idx % 3 === 0) {
        entry.checkedIn = true;
        await TicketOrder.updateOne({ _id: entry.doc._id }, { $set: { checkedInAt: at(-1, 12 + (idx % 5)) } });
      }
    }
  }
  for (const entry of paidTickets) {
    if (!entry.checkedIn) continue;
    const order = await TicketOrder.findById(entry.doc._id).select("expo attendee checkedInAt");
    await CheckIn.create({
      ticket: order._id,
      expo: order.expo,
      attendee: order.attendee,
      checkedInAt: order.checkedInAt || now,
      checkedInBy: staffUser._id,
      method: "QR",
    });
  }
  console.log(`Tickets: ${await TicketOrder.countDocuments()}  Check-ins: ${await CheckIn.countDocuments()}`);

  // ---------------------------------------------------------------------------
  // Sessions (+ deliberate overlap for conflict detection) and speakers
  // ---------------------------------------------------------------------------
  const liveSessions = await Session.create([
    { expo: liveExpo._id, title: "Opening Keynote: Innovation at Scale", topic: "Keynote", speaker: "Bilal Ahmed", location: "Hall A", startTime: at(0, 9, 0), endTime: at(0, 10, 0), capacity: 500, attendees: allAttendees.slice(0, 4).map((u) => u._id) },
    { expo: liveExpo._id, title: "Robotics on the Factory Floor", topic: "Robotics", speaker: "Hamza Sheikh", location: "Hall B", startTime: at(0, 11, 0), endTime: at(0, 12, 0), capacity: 200, attendees: allAttendees.slice(2, 6).map((u) => u._id) },
    { expo: liveExpo._id, title: "Cloud Cost Optimization Panel", topic: "Cloud", speaker: "Mariam Iqbal", location: "Hall B", startTime: at(0, 11, 30), endTime: at(0, 12, 30), capacity: 200, attendees: [] },
    { expo: liveExpo._id, title: "AI in Healthcare Workshop", topic: "AI", speaker: "Hina Raza", location: "Hall C", startTime: at(0, 14, 0), endTime: at(0, 15, 30), capacity: 120, attendees: allAttendees.slice(0, 3).map((u) => u._id) },
    { expo: liveExpo._id, title: "Startup Pitch Finals", topic: "Startups", speaker: "Zain Abbas", location: "Main Stage", startTime: at(1, 15, 0), endTime: at(1, 17, 0), capacity: 800, attendees: [] },
  ]);
  const upcomingSessions = await Session.create([
    { expo: upcomingExpo._id, title: "From Seed to Series A", topic: "Fundraising", speaker: "Bilal Ahmed", location: "Hall A", startTime: at(14, 10, 0), endTime: at(14, 11, 0), capacity: 300, attendees: [] },
    { expo: upcomingExpo._id, title: "Building a Remote-First Team", topic: "Operations", speaker: "Fatima Noor", location: "Hall A", startTime: at(15, 11, 0), endTime: at(15, 12, 0), capacity: 300, attendees: [] },
  ]);
  await Session.create([
    { expo: completedExpo._id, title: "Digital Diagnostics in Practice", topic: "Health", speaker: "Dr. Sana Malik", location: "Ballroom", startTime: at(-44, 10, 0), endTime: at(-44, 11, 30), capacity: 400, attendees: [] },
  ]);

  await Speaker.create([
    { expo: liveExpo._id, name: "Bilal Ahmed", title: "Lead Organizer", company: "Momentum Events", email: "organizer@eventsphere.demo", bio: "Serial event organizer.", session: liveSessions[0]._id },
    { expo: liveExpo._id, name: "Hamza Sheikh", title: "Head of Growth", company: "Quantum Robotics", email: "exhibitor@eventsphere.demo", bio: "Robotics automation specialist.", session: liveSessions[1]._id },
    { expo: liveExpo._id, name: "Mariam Iqbal", title: "Partnerships", company: "Nimbus Cloud", email: "exhibitor2@eventsphere.demo", session: liveSessions[2]._id },
    { expo: upcomingExpo._id, name: "Fatima Noor", title: "Marketing Lead", company: "Retail Co.", email: "attendee2@eventsphere.demo", session: upcomingSessions[1]._id },
  ]);

  // ---------------------------------------------------------------------------
  // Sponsors + staff
  // ---------------------------------------------------------------------------
  await Sponsor.create([
    { expo: liveExpo._id, name: "Quantum Robotics", tier: "Platinum", contactName: "Hamza Sheikh", email: "exhibitor@eventsphere.demo", phone: "+92 42 1110001", amount: 1500000, status: "paid", notes: "Title sponsor, main stage branding.", logo: "/eventspace-hero-visual.jpg" },
    { expo: liveExpo._id, name: "Nimbus Cloud", tier: "Gold", contactName: "Mariam Iqbal", email: "exhibitor2@eventsphere.demo", amount: 750000, status: "approved" },
    { expo: upcomingExpo._id, name: "FinEdge", tier: "Silver", contactName: "Rabia Aslam", email: "attendee6@eventsphere.demo", amount: 300000, status: "pending" },
  ]);

  const staffDocs = await Staff.create([
    { name: "Sana Malik", email: "staff@eventsphere.demo", phone: "+92 300 0000003", role: "Floor Manager", event: liveExpo._id, salary: 90000, salaryType: "monthly", shiftStart: "09:00", shiftEnd: "18:00", createdBy: organizer._id },
    { name: "Imran Yousaf", email: "imran.staff@eventsphere.demo", role: "Registration Desk", event: liveExpo._id, salary: 4500, salaryType: "daily", shiftStart: "08:30", shiftEnd: "17:30", createdBy: organizer._id },
    { name: "Nida Kamal", email: "nida.staff@eventsphere.demo", role: "Technical Support", event: liveExpo._id, salary: 60, salaryType: "hourly", shiftStart: "10:00", shiftEnd: "19:00", createdBy: organizer._id },
    { name: "Asad Mehmood", email: "asad.staff@eventsphere.demo", role: "Security", event: upcomingExpo._id, salary: 70000, salaryType: "monthly", active: false, createdBy: organizer._id },
  ]);

  // ---------------------------------------------------------------------------
  // Budget (planned vs actual income/expense)
  // ---------------------------------------------------------------------------
  await FinanceTransaction.create([
    { expo: liveExpo._id, type: "income", entryType: "planned", currency: "PKR", category: "Sponsorship", description: "Platinum + Gold sponsor packages", amount: 2250000, date: at(-30, 12), createdBy: organizer._id },
    { expo: liveExpo._id, type: "income", entryType: "actual", currency: "PKR", category: "Sponsorship", description: "Sponsor payments received", amount: 2250000, date: at(-20, 12), createdBy: organizer._id },
    { expo: liveExpo._id, type: "income", entryType: "planned", currency: "PKR", category: "Ticket Sales", description: "Projected ticket revenue", amount: 1400000, date: at(-30, 12), createdBy: organizer._id },
    { expo: liveExpo._id, type: "income", entryType: "actual", currency: "PKR", category: "Ticket Sales", description: "Ticket revenue to date", amount: 860000, date: at(-1, 12), createdBy: organizer._id },
    { expo: liveExpo._id, type: "expense", entryType: "planned", currency: "PKR", category: "Venue", description: "Venue rental + halls", amount: 600000, date: at(-30, 12), createdBy: organizer._id },
    { expo: liveExpo._id, type: "expense", entryType: "actual", currency: "PKR", category: "Venue", description: "Venue rental paid", amount: 600000, date: at(-25, 12), createdBy: organizer._id },
    { expo: liveExpo._id, type: "expense", entryType: "planned", currency: "PKR", category: "Marketing", description: "Campaign + media buy", amount: 400000, date: at(-30, 12), createdBy: organizer._id },
    { expo: liveExpo._id, type: "expense", entryType: "actual", currency: "PKR", category: "Marketing", description: "Campaign spend", amount: 455000, date: at(-5, 12), createdBy: organizer._id },
    { expo: liveExpo._id, type: "expense", entryType: "actual", currency: "PKR", category: "Catering", description: "VIP lounge catering", amount: 120000, date: at(-1, 12), createdBy: organizer._id },
    { expo: upcomingExpo._id, type: "income", entryType: "planned", currency: "PKR", category: "Sponsorship", description: "Pipeline sponsors", amount: 500000, date: at(10, 12), createdBy: organizer._id },
    { expo: upcomingExpo._id, type: "expense", entryType: "planned", currency: "PKR", category: "Venue", description: "Karachi Expo Center", amount: 450000, date: at(10, 12), createdBy: organizer._id },
    { expo: completedExpo._id, type: "income", entryType: "planned", currency: "PKR", category: "Ticket Sales", description: "Forum ticket revenue (planned)", amount: 600000, date: at(-60, 12), createdBy: organizer._id },
    { expo: completedExpo._id, type: "income", entryType: "actual", currency: "PKR", category: "Ticket Sales", description: "Forum ticket revenue received", amount: 640000, date: at(-44, 12), createdBy: organizer._id },
    { expo: completedExpo._id, type: "expense", entryType: "planned", currency: "PKR", category: "Venue", description: "Serena Hall rental", amount: 350000, date: at(-60, 12), createdBy: organizer._id },
    { expo: completedExpo._id, type: "expense", entryType: "actual", currency: "PKR", category: "Venue", description: "Serena Hall rental paid", amount: 350000, date: at(-50, 12), createdBy: organizer._id },
    { expo: draftExpo._id, type: "income", entryType: "planned", currency: "PKR", category: "Sponsorship", description: "Draft sponsorship target", amount: 750000, date: at(55, 12), createdBy: organizer._id },
    { expo: draftExpo._id, type: "expense", entryType: "planned", currency: "PKR", category: "Marketing", description: "Draft launch budget", amount: 200000, date: at(55, 12), createdBy: organizer._id },
  ]);

  // ---------------------------------------------------------------------------
  // Team tasks
  // ---------------------------------------------------------------------------
  await Task.create([
    { expo: liveExpo._id, title: "Finalize exhibitor floor map", description: "Lock booth positions for Hall A and B.", priority: "high", status: "completed", dueDate: at(-3, 17), assignee: staffUser._id, createdBy: organizer._id, completedAt: at(-3, 16), tags: ["floor", "exhibitors"] },
    { expo: liveExpo._id, title: "Print attendee badges", description: "Batch print all paid tickets.", priority: "critical", status: "in-progress", dueDate: at(0, 18), assignee: staffUser._id, createdBy: organizer._id, tags: ["registration"] },
    { expo: liveExpo._id, title: "Brief stage crew", description: "Walk through the keynote run-of-show.", priority: "medium", status: "todo", dueDate: at(0, 8), assignee: staffUser._id, createdBy: organizer._id, tags: ["stage"] },
    { expo: liveExpo._id, title: "Confirm VIP catering", description: "Final headcount with caterer.", priority: "high", status: "in-progress", dueDate: at(1, 12), assignee: admin._id, createdBy: organizer._id, tags: ["catering", "vip"] },
    { expo: upcomingExpo._id, title: "Open speaker call", description: "Publish call for speakers form.", priority: "medium", status: "todo", dueDate: at(5, 17), createdBy: organizer._id, tags: ["marketing"] },
    { expo: upcomingExpo._id, title: "Sign venue contract", description: "Counter-sign the Karachi venue agreement.", priority: "critical", status: "completed", dueDate: at(-7, 17), assignee: organizer._id, createdBy: organizer._id, completedAt: at(-7, 15), tags: ["legal"] },
    { expo: completedExpo._id, title: "Publish post-event report", description: "Share the attendance and feedback summary with sponsors.", priority: "medium", status: "completed", dueDate: at(-40, 17), assignee: organizer._id, createdBy: organizer._id, completedAt: at(-40, 15), tags: ["reporting"] },
    { expo: completedExpo._id, title: "Send thank-you emails", description: "Thank speakers and sponsors after the forum.", priority: "low", status: "in-progress", dueDate: at(-38, 17), assignee: staffUser._id, createdBy: organizer._id, tags: ["email"] },
    { expo: draftExpo._id, title: "Draft conference theme", description: "Working title and visual direction for the design conference.", priority: "low", status: "todo", dueDate: at(30, 17), createdBy: organizer._id, tags: ["design"] },
  ]);

  // ---------------------------------------------------------------------------
  // Leads
  // ---------------------------------------------------------------------------
  await Lead.create([
    { expo: liveExpo._id, exhibitor: exhibitorUser1._id, attendee: allAttendees[0]._id, name: allAttendees[0].name, email: allAttendees[0].email, company: allAttendees[0].company, source: "booth", status: "new", notes: "Interested in AMR pilot." },
    { expo: liveExpo._id, exhibitor: exhibitorUser1._id, attendee: allAttendees[1]._id, name: allAttendees[1].name, email: allAttendees[1].email, company: allAttendees[1].company, source: "session", status: "contacted", notes: "Requested pricing deck.", followUpAt: at(3, 10) },
    { expo: liveExpo._id, exhibitor: exhibitorUser1._id, name: "Sara Ahmed", email: "sara@factoryworks.example.com", company: "FactoryWorks", source: "booth", status: "qualified", notes: "Warehouse automation RFP in Q1." },
    { expo: liveExpo._id, exhibitor: exhibitorUser1._id, name: "Danish Riaz", email: "danish@logisticspro.example.com", company: "LogisticsPro", source: "booth", status: "won", notes: "Signed pilot contract." },
    { expo: liveExpo._id, exhibitor: exhibitorUser2._id, attendee: allAttendees[3]._id, name: allAttendees[3].name, email: allAttendees[3].email, company: allAttendees[3].company, source: "booth", status: "lost", notes: "Chose another vendor." },
  ]);

  // ---------------------------------------------------------------------------
  // Engagement + operations + feedback
  // ---------------------------------------------------------------------------
  const engagements = [];
  for (const [i, attendee] of allAttendees.entries()) {
    engagements.push({ expo: liveExpo._id, user: attendee._id, type: "session", targetId: liveSessions[i % liveSessions.length]._id, metadata: { title: liveSessions[i % liveSessions.length].title } });
    engagements.push({ expo: liveExpo._id, user: attendee._id, type: "booth", targetId: boothDocs[i % boothDocs.length]._id, metadata: { boothNumber: boothDocs[i % boothDocs.length].boothNumber } });
    if (i % 2 === 0) engagements.push({ expo: liveExpo._id, user: attendee._id, type: "networking", metadata: { with: "Quantum Robotics" } });
  }
  await EventEngagement.create(engagements);

  await OperationItem.create([
    { expo: liveExpo._id, type: "task", title: "Restock registration printers", description: "Hall A desk is low on badge stock.", priority: "high", status: "open", area: "Hall A", assignedTo: staffDocs[1]._id, createdBy: organizer._id },
    { expo: liveExpo._id, type: "incident", title: "Mic feedback in Hall B", description: "Audio feedback during the panel session.", priority: "medium", status: "in-progress", area: "Hall B", assignedTo: staffDocs[2]._id, createdBy: organizer._id },
    { expo: liveExpo._id, type: "announcement", title: "Lunch service at 13:00", description: "All attendees to the main lounge.", priority: "low", status: "resolved", area: "Lounge", createdBy: organizer._id },
  ]);

  await Feedback.create([
    { user: allAttendees[0]._id, expo: liveExpo._id, rating: 5, message: "Great keynote and a very well organized floor." },
    { user: allAttendees[1]._id, expo: liveExpo._id, rating: 4, message: "Loved the robotics demos. Hall signage could be clearer." },
    { user: allAttendees[2]._id, expo: completedExpo._id, rating: 5, message: "Excellent healthcare sessions." },
  ]);

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  await Message.create([
    { sender: organizer._id, recipient: exhibitorUser1._id, text: "Hi Hamza, please be at booth A1 by 08:30 for setup." },
    { sender: exhibitorUser1._id, recipient: organizer._id, text: "Noted, we are on our way." },
    { sender: admin._id, recipient: organizer._id, text: "Analytics look strong today. Nice work!" },
    { sender: allAttendees[0]._id, recipient: exhibitorUser1._id, text: "Could you share the AMR spec sheet?" },
  ]);

  // ---------------------------------------------------------------------------
  // Marketing (campaigns + templates)
  // ---------------------------------------------------------------------------
  await Campaign.create([
    { expo: liveExpo._id, subject: "TechNova is live — see you today", message: "The doors are open! Check the agenda and your pass.", audience: "attendees", sentCount: 842, status: "sent", sentAt: at(-1, 7), createdBy: organizer._id },
    { expo: upcomingExpo._id, subject: "Early-bird pricing ends soon", message: "Grab your Global Startup Summit pass before prices rise.", audience: "all", status: "draft", createdBy: organizer._id },
  ]);

  await EmailTemplate.create([
    { name: "Ticket confirmation", subject: "Your EventSphere ticket is confirmed", body: "Hi {{name}}, your {{passType}} pass for {{event}} is confirmed. Invoice: {{invoiceNo}}.", category: "ticket", createdBy: organizer._id },
    { name: "Event reminder", subject: "{{event}} starts tomorrow", body: "Hi {{name}}, a reminder that {{event}} begins tomorrow at {{location}}.", category: "reminder", createdBy: organizer._id },
  ]);

  // ---------------------------------------------------------------------------
  // Registrations
  // ---------------------------------------------------------------------------
  const registrations = [];
  for (const [i, attendee] of allAttendees.entries()) {
    registrations.push({ expo: liveExpo._id, user: attendee._id, type: "attendee", status: i % 5 === 0 ? "pending" : "approved" });
  }
  await ExpoRegistration.create(registrations);

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  await Notification.create([
    { user: organizer._id, title: "Ticket sold", message: "A VIP Pass for TechNova Expo 2026 was just purchased.", type: "ticket", data: { expo: liveExpo._id }, read: false },
    { user: organizer._id, title: "Attendance milestone", message: "50% of paid attendees have checked in.", type: "checkin", data: { expo: liveExpo._id }, read: false },
    { user: organizer._id, title: "Budget alert", message: "Marketing spend is 13% over the planned budget.", type: "budget", data: { expo: liveExpo._id }, read: false },
    { user: organizer._id, title: "New lead", message: "Quantum Robotics added a qualified lead.", type: "lead", read: true, readAt: at(-1, 15) },
    { user: admin._id, title: "Welcome to EventSphere", message: "Your admin workspace is ready.", type: "system", read: false },
    { user: exhibitorUser1._id, title: "Booth assigned", message: "You have been assigned booth A1 at TechNova Expo 2026.", type: "system", data: { expo: liveExpo._id }, read: false },
    { user: allAttendees[0]._id, title: "Checked in", message: "You are checked in for TechNova Expo 2026.", type: "checkin", data: { expo: liveExpo._id }, read: false },
    { user: allAttendees[1]._id, title: "Session reminder", message: "Robotics on the Factory Floor starts at 11:00.", type: "session", data: { expo: liveExpo._id }, read: false },
  ]);

  // ---------------------------------------------------------------------------
  // Activity feed
  // ---------------------------------------------------------------------------
  await Activity.create([
    { actor: organizer._id, actorName: organizer.name, action: "created", entityType: "Event", entityId: liveExpo._id, expo: liveExpo._id, summary: "Created event TechNova Expo 2026", meta: {} },
    { actor: admin._id, actorName: admin.name, action: "updated", entityType: "Booth", expo: liveExpo._id, summary: "Assigned booth A1 to Quantum Robotics", meta: {} },
    { actor: staffUser._id, actorName: staffUser.name, action: "assigned", entityType: "Task", expo: liveExpo._id, summary: "Assigned task “Print attendee badges”", meta: {} },
    { actor: organizer._id, actorName: organizer.name, action: "updated", entityType: "Budget", expo: liveExpo._id, summary: "Recorded marketing spend PKR 455,000", meta: {} },
    { actor: organizer._id, actorName: organizer.name, action: "issued", entityType: "Ticket", expo: upcomingExpo._id, summary: "Ticket issued (Pro Pass)", meta: {} },
  ]);

  // ---------------------------------------------------------------------------
  // Audit log
  // ---------------------------------------------------------------------------
  await AuditLog.create([
    { actor: admin._id, action: "login", entity: "User", entityId: String(admin._id), details: { method: "password" }, ip: "127.0.0.1" },
    { actor: organizer._id, action: "create", entity: "Expo", entityId: String(liveExpo._id), details: { title: liveExpo.title }, ip: "127.0.0.1" },
  ]);

  console.log("\nSummary");
  console.log("-------");
  console.log(`Users:              ${await User.countDocuments()}`);
  console.log(`Venues:             ${await Venue.countDocuments()}`);
  console.log(`Events:             ${await Expo.countDocuments()}`);
  console.log(`Booths:             ${await Booth.countDocuments()}`);
  console.log(`Exhibitors:         ${await Exhibitor.countDocuments()}`);
  console.log(`Sessions:           ${await Session.countDocuments()}`);
  console.log(`Tickets:            ${await TicketOrder.countDocuments()}`);
  console.log(`Check-ins:          ${await CheckIn.countDocuments()}`);
  console.log(`Budget entries:     ${await FinanceTransaction.countDocuments()}`);
  console.log(`Tasks:              ${await Task.countDocuments()}`);
  console.log(`Notifications:      ${await Notification.countDocuments()}`);
  console.log(`Activity entries:   ${await Activity.countDocuments()}`);

  console.log("\nDemo logins (password: " + PASSWORD + ")");
  console.log("  admin@eventsphere.demo       -> admin (sees everything)");
  console.log("  staff@eventsphere.demo       -> staff (check-in desk)");
  console.log("  exhibitor@eventsphere.demo   -> exhibitor");
  console.log("  attendee@eventsphere.demo    -> attendee");
  console.log(`  Organizer events are owned by: ${organizer.email} (use your own password)`);

  await mongoose.disconnect();
  console.log("\nSeed complete.");
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
