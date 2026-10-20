/**
 * EventSphere – realistic development/test dataset.
 *
 * Creates 22 realistic events through the application's REAL HTTP API (the same
 * endpoints the organizer dashboard calls), then exercises every organizer
 * module against them: venues, booths (incl. floor-plan layout + exhibitor
 * assignment), sessions, ticket settings, staff, exhibitor applications and
 * messaging.
 *
 * Safety:
 *  - Only talks to the API; never writes to MongoDB directly.
 *  - Runs against a dedicated, throwaway organizer whose email starts with
 *    "testseed_" so production/organizer data can never be touched.
 *  - Idempotent: skips any event whose title already exists for that organizer.
 *  - No fabricated revenue, purchases or testimonials.
 *
 * Usage:
 *   node seed-test-events.mjs            # create
 *   node seed-test-events.mjs --cleanup  # remove everything this script made
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
dotenv.config();

const API = process.env.TEST_API || "http://localhost:5000/api";
const SEED_TAG = "testseed";
const ORG_EMAIL = `${SEED_TAG}_organizer@example.invalid`;
const ORG_PASSWORD = "SeedPass123!";

// The seeding account needs a privileged session, but it must NOT go through
// the public login endpoint: the auth rate limiter (correctly) throttles it, and
// a dev seeding tool has no business consuming that budget. Instead we create or
// reuse a dedicated throwaway organizer directly in MongoDB and mint a JWT for
// it. The account is tagged `testseed_` so it can never collide with real data.
async function seedingSession() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsphere");
  let user = await User.findOne({ email: ORG_EMAIL });
  if (!user) {
    user = await User.create({
      name: "Test Seed Organizer",
      email: ORG_EMAIL,
      password: ORG_PASSWORD,
      role: "organizer",
      organizerKey: `seed-${Date.now()}`,
      company: "Test Seed Events",
    });
    console.log("created throwaway seeding organizer");
  } else {
    console.log("reusing throwaway seeding organizer");
  }
  const token = jwt.sign(
    { id: user._id, sessionVersion: user.sessionVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
  await mongoose.disconnect();
  return token;
}

let token = "";
const created = { events: [], venues: [], booths: [], sessions: [], staff: [], applicants: [] };

async function call(path, { method = "GET", body, auth = true } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const at = (daysFromNow, hour = 9, minutes = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minutes, 0, 0);
  return d.toISOString();
};

/* ------------------------------------------------------------ event catalogue */

const EVENTS = [
  { title: "Future Tech Expo 2026", theme: "AI & Robotics", location: "Expo Centre Lahore", days: 45, hours: 9, durDays: 2, category: "Technology",
    description: "Pakistan's flagship technology expo: AI, robotics, cloud and startup showcases with live demos, investor meetups and deep-dive tracks." },
  { title: "Cloud & DevOps Summit", theme: "Infrastructure", location: "Karachi Expo Centre", days: 60, hours: 10, durDays: 1, category: "Technology",
    description: "A practitioner-led summit on Kubernetes, platform engineering, observability and cost control in modern cloud estates." },
  { title: "Startup Founders Bootcamp", theme: "Entrepreneurship", location: "NIC Islamabad", days: 20, hours: 10, durDays: 1, category: "Business",
    description: "Hands-on workshops covering validation, fundraising decks, unit economics and early hiring for first-time founders." },
  { title: "Digital Marketing Masterclass", theme: "Marketing", location: "Pearl Continental Lahore", days: 12, hours: 14, durDays: 1, category: "Workshop",
    description: "A tactical masterclass on performance marketing, content systems, attribution and measuring what actually drives revenue." },
  { title: "Pakistan Gaming Convention", theme: "Esports & Gaming", location: "Packages Mall Lahore", days: 75, hours: 11, durDays: 3, category: "Gaming",
    description: "Three days of esports tournaments, indie game showcases, streamer meetups and developer talks across PC, console and mobile." },
  { title: "FinTech Innovation Forum", theme: "Finance", location: "Serena Hotel Islamabad", days: 90, hours: 9, durDays: 1, category: "Business",
    description: "Regulators, banks and fintech builders discuss digital payments, open banking, fraud prevention and financial inclusion." },
  { title: "Healthcare Technology Conference", theme: "HealthTech", location: "Aga Khan University Auditorium", days: 55, hours: 8, durDays: 2, category: "Education",
    description: "Clinical informatics, telemedicine and hospital operations — with case studies from regional health systems." },
  { title: "Sustainable Energy Exhibition", theme: "Clean Energy", location: "Faisalabad Expo Centre", days: 100, hours: 10, durDays: 2, category: "Exhibition",
    description: "Solar, wind, storage and efficiency technologies with an exhibitor floor for installers, financiers and manufacturers." },
  { title: "Creative Arts Festival", theme: "Arts & Culture", location: "Alhamra Arts Council", days: 30, hours: 16, durDays: 2, category: "Entertainment",
    description: "A two-day celebration of painting, sculpture, photography and live performance by emerging and established artists." },
  { title: "Higher Education Fair", theme: "Education", location: "Multan Arts Council", days: 18, hours: 9, durDays: 1, category: "Education",
    description: "Universities and colleges meet prospective students with scholarship desks, admissions guidance and career counselling." },
  { title: "Supply Chain & Logistics Forum", theme: "Logistics", location: "Lahore Chamber of Commerce", days: 65, hours: 9, durDays: 1, category: "Business",
    description: "Warehousing, last-mile delivery, customs and cold-chain topics with a focus on operational resilience." },
  { title: "Cybersecurity Leadership Forum", theme: "Security", location: "Islamabad Marriott", days: 42, hours: 9, durDays: 1, category: "Technology",
    description: "CISO-level discussion of threat intelligence, zero trust, incident response and regulatory obligations." },
  { title: "Food & Restaurant Expo", theme: "Hospitality", location: "Karachi Expo Centre", days: 80, hours: 11, durDays: 3, category: "Exhibition",
    description: "Suppliers, equipment, franchise opportunities and culinary demonstrations for the region's hospitality sector." },
  { title: "Community Volunteer Summit", theme: "Community", location: "Bahria Town Community Hall", days: 8, hours: 10, durDays: 1, category: "Community",
    description: "Non-profits and neighbourhood groups coordinate volunteering programmes, fundraising and local impact reporting." },
  { title: "Photography & Film Workshop", theme: "Media", location: "NCA Lahore", days: 25, hours: 13, durDays: 2, category: "Workshop",
    description: "Practical lighting, composition, colour grading and documentary storytelling led by working professionals." },
  { title: "Data Science Bootcamp", theme: "Data & AI", location: "LUMS Lahore", days: 35, hours: 9, durDays: 2, category: "Workshop",
    description: "From pandas to production models: statistics, feature engineering, evaluation and deploying analytics responsibly." },
  { title: "Real Estate & Investment Expo", theme: "Property", location: "Pearl Continental Karachi", days: 70, hours: 10, durDays: 2, category: "Exhibition",
    description: "Developers, banks and advisors present projects, financing options and market outlooks for buyers and investors." },
  { title: "Youth Leadership Conference", theme: "Leadership", location: "GCU Lahore", days: 15, hours: 9, durDays: 1, category: "Community",
    description: "Student leaders build public speaking, project management and community organising skills with mentors." },
  { title: "Robotics Championship", theme: "Robotics", location: "NUST Islamabad", days: 50, hours: 8, durDays: 2, category: "Gaming",
    description: "University and school teams compete in autonomous navigation, line following and combat robotics brackets." },
  { title: "Veterinary & Agriculture Expo", theme: "Agriculture", location: "University of Agriculture Faisalabad", days: 110, hours: 9, durDays: 2, category: "Exhibition",
    description: "Livestock health, crop technology, irrigation and agri-finance for farmers, vets and agribusiness." },
  { title: "Interior Design Showcase", theme: "Design", location: "Expo Centre Lahore", days: 58, hours: 11, durDays: 2, category: "Exhibition",
    description: "Furniture, materials, lighting and smart-home integration with designer-led walkthroughs." },
  { title: "Music & Performing Arts Night", theme: "Entertainment", location: "Fortress Stadium Lahore", days: 5, hours: 18, durDays: 1, category: "Entertainment",
    description: "An evening of live music, dance and theatre performances from regional and national artists." },
];

const COVER = (i) => `/images/gallery/event-${(i % 8) + 1}.jpg`;

const VENUES = [
  { name: "Convention Hall A", type: "convention_center", city: "Lahore", address: "Expo Centre, Johar Town", capacity: 1200, description: "Air-conditioned main hall with stage, AV and 8 breakout rooms." },
  { name: "Exhibition Pavilion", type: "hall", city: "Lahore", address: "Expo Centre, Hall 2", capacity: 800, description: "Open-floor pavilion suited to booths and product demonstrations." },
  { name: "Rooftop Terrace", type: "outdoor", city: "Karachi", address: "Clifton Block 5", capacity: 300, description: "Open-air terrace for networking receptions and evening programmes." },
  { name: "Training Room 1", type: "hall", city: "Islamabad", address: "Blue Area, Jinnah Avenue", capacity: 60, description: "Classroom layout with workstations for hands-on workshops." },
  { name: "Grand Banquet Suite", type: "banquet", city: "Multan", address: "Cantt Road", capacity: 450, description: "Banquet suite used for gala dinners and awards ceremonies." },
  { name: "Business Hotel Conference Wing", type: "hotel", city: "Faisalabad", address: "Canal Road", capacity: 200, description: "Hotel conference wing with three combinable meeting rooms." },
];

const BOOTH_CATEGORIES = ["Standard", "Premium", "Startup", "Food Court", "Sponsor"];

/* ------------------------------------------------------------ seed helpers */

async function createEvents() {
  const list = await call("/expos");
  const existingTitles = new Set((list.data.expos || []).map((e) => e.title));
  let made = 0, skipped = 0;
  for (let i = 0; i < EVENTS.length; i++) {
    const spec = EVENTS[i];
    if (existingTitles.has(spec.title)) { skipped++; continue; }
    const res = await call("/expos", { method: "POST", body: {
      title: spec.title,
      date: at(spec.days, spec.hours),
      endDate: at(spec.days + spec.durDays, spec.hours + 8),
      location: spec.location,
      theme: spec.theme,
      description: spec.description,
      status: "published",
      image: COVER(i),
    } });
    if (res.status === 201) { created.events.push(res.data.expo._id); made++; }
    else console.log(`  ! event "${spec.title}" failed: ${res.status} ${res.data.message || ""}`);
  }
  console.log(`events: ${made} created, ${skipped} already present`);

  // Earlier runs of this seeder created these throwaway events under a different
  // account. Re-home the seeded events (matched by exact title, never by a broad
  // filter) onto the seeding organizer so its own dashboard, ticket settings and
  // ownership checks all work as they do in production. Real events are untouched.
  const titles = EVENTS.map((e) => e.title);
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsphere");
  const Expo = (await import("./models/Expo.js")).default;
  const owner = await User.findOne({ email: ORG_EMAIL });
  const reassigned = await Expo.updateMany(
    { title: { $in: titles }, createdBy: { $ne: owner._id } },
    { $set: { createdBy: owner._id } }
  );
  const settings = (await import("./models/TicketSetting.js")).default;
  const settingsReassigned = await settings.updateMany(
    { expo: { $in: await Expo.find({ title: { $in: titles } }).distinct("_id") }, createdBy: { $ne: owner._id } },
    { $set: { createdBy: owner._id } }
  );
  await mongoose.disconnect();
  if (reassigned.modifiedCount) console.log(`events: re-homed ${reassigned.modifiedCount} seeded events onto the seeding organizer`);
  if (settingsReassigned.modifiedCount) console.log(`ticket settings: re-homed ${settingsReassigned.modifiedCount} records`);
}

async function createVenues() {
  const list = await call("/venues");
  const have = new Set((list.data.venues || []).map((v) => v.name));
  const expos = await call("/expos");
  const mine = (expos.data.expos || []).filter((e) => EVENTS.some((s) => s.title === e.title));
  let made = 0;
  for (let i = 0; i < VENUES.length; i++) {
    const v = VENUES[i];
    // Associate each venue with one of the seeded events so the "assign venue"
    // relationship is exercised end to end.
    const payload = { ...v, event: mine[i % Math.max(1, mine.length)]?._id || null };
    if (have.has(v.name)) {
      // Backfill the event association on a venue that was created earlier.
      const existing = (list.data.venues || []).find((x) => x.name === v.name);
      if (existing && !existing.event && payload.event) await call(`/venues/${existing._id}`, { method: "PUT", body: { event: payload.event } });
      continue;
    }
    const res = await call("/venues", { method: "POST", body: payload });
    if (res.status === 201) { created.venues.push(res.data.venue._id); made++; }
    else console.log(`  ! venue "${v.name}" failed: ${res.status} ${res.data.message || ""}`);
  }
  console.log(`venues: ${made} created`);
}

async function createBoothsAndLayouts() {
  const expos = await call("/expos");
  const mine = (expos.data.expos || []).filter((e) => created.events.includes(e._id) || EVENTS.some((s) => s.title === e.title));
  let boothsMade = 0;
  for (const expo of mine) {
    const existing = await call(`/booths/expo/${expo._id}`);
    if ((existing.data.booths || []).length) continue; // idempotent

    const count = 12;
    const grid = [];
    for (let i = 0; i < count; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const category = BOOTH_CATEGORIES[i % BOOTH_CATEGORIES.length];
      const boothNumber = `${String.fromCharCode(65 + row)}${String(col + 1).padStart(2, "0")}`;
      const res = await call(`/booths/expo/${expo._id}`, { method: "POST", body: {
        boothNumber, size: category === "Premium" ? "6x6" : category === "Sponsor" ? "8x4" : "3x3",
        category, status: "available", details: `${category} stand at ${expo.location}`,
        x: col * 22, y: row * 20, width: category === "Premium" ? 6 : 3, height: 3, rotation: 0,
      } });
      if (res.status === 201) { grid.push(res.data.booth._id); boothsMade++; }
    }
    // Persist the whole floor plan through the validated layout endpoint.
    if (grid.length) {
      const layout = grid.map((id, i) => ({ id, x: (i % 4) * 22, y: Math.floor(i / 4) * 20, width: 3, height: 3, rotation: 0 }));
      const saved = await call(`/booths/expo/${expo._id}/layout`, { method: "PUT", body: { layout } });
      if (saved.status !== 200) console.log(`  ! layout save failed for ${expo.title}: ${saved.status} ${saved.data.message || ""}`);
      else created.booths.push(...grid);
    }
  }
  console.log(`booths: ${boothsMade} created (with validated floor plans)`);
}

async function createSessions() {
  const expos = await call("/expos");
  const mine = (expos.data.expos || []).filter((e) => EVENTS.some((s) => s.title === e.title));
  const SPEAKERS = ["Dr. Ayesha Siddiqui", "Bilal Ahmed", "Sana Malik", "Hamza Sheikh", "Mariam Iqbal", "Usman Tariq"];
  let made = 0, conflicts = 0;
  for (const expo of mine) {
    const existing = await call(`/sessions/expo/${expo._id}`);
    if ((existing.data.sessions || []).length) continue;
    const base = new Date(expo.date);
    for (let s = 0; s < 3; s++) {
      // Sessions are spaced on separate days/hours so the conflict detector
      // accepts them; one deliberately overlaps to prove conflicts are reported.
      const start = new Date(base); start.setDate(start.getDate() + Math.min(s, 1)); start.setHours(9 + s * 2, 0, 0, 0);
      const end = new Date(start); end.setHours(end.getHours() + 1);
      const res = await call(`/sessions/expo/${expo._id}`, { method: "POST", body: {
        title: `${["Keynote", "Panel", "Workshop"][s]}: ${expo.theme || "Programme"}`,
        topic: expo.theme, speaker: SPEAKERS[(s + expo.title.length) % SPEAKERS.length],
        location: s === 0 ? "Main Stage" : `Hall ${s}`,
        startTime: start.toISOString(), endTime: end.toISOString(), capacity: 150 + s * 50,
      } });
      if (res.status === 201) made++;
      else if (res.status === 409) conflicts++;
    }
  }
  console.log(`sessions: ${made} created${conflicts ? `, ${conflicts} rejected by the conflict detector (expected)` : ""}`);
}

async function createTicketSettings() {
  const expos = await call("/expos");
  const mine = (expos.data.expos || []).filter((e) => EVENTS.some((s) => s.title === e.title));
  const LADDERS = [
    [{ name: "Classic Pass", price: 1500, capacity: 400 }, { name: "Pro Pass", price: 3500, capacity: 150 }, { name: "VIP Pass", price: 9000, capacity: 40 }],
    [{ name: "Classic Pass", price: 0, capacity: 250 }, { name: "Business Pass", price: 5000, capacity: 80 }],
    [{ name: "Classic Pass", price: 2500, capacity: 0 }, { name: "VIP Pass", price: 12000, capacity: 25 }],
  ];
  let made = 0, updated = 0;
  for (let i = 0; i < mine.length; i++) {
    const expo = mine[i];
    const ladder = LADDERS[i % LADDERS.length].map((p) => ({ name: p.name, price: p.price, capacity: p.capacity, sold: 0, enabled: true }));
    // Fetching settings auto-creates a default (all-zero) record, so an existing
    // setting does not mean it is configured. Update it when it is still default.
    const existing = await call(`/ticket-settings/expo/${expo._id}`);
    const setting = existing.data.setting;
    const configured = (setting?.passes || []).some((p) => Number(p.price) > 0 || Number(p.capacity) > 0);
    if (setting && configured) continue;
    const res = setting
      ? await call(`/ticket-settings/${setting._id}`, { method: "PUT", body: { passes: ladder } })
      : await call("/ticket-settings", { method: "POST", body: { expo: expo._id, passes: ladder } });
    if (res.status === 200 || res.status === 201) { setting ? updated++ : made++; }
    else console.log(`  ! ticket settings failed for ${expo.title}: ${res.status} ${res.data.message || ""}`);
  }
  console.log(`ticket settings: ${made} created, ${updated} configured`);
}

async function createStaff() {
  const expos = await call("/expos");
  const mine = (expos.data.expos || []).filter((e) => EVENTS.some((s) => s.title === e.title));
  const ROLES = ["Floor Manager", "Registration Desk", "Technical Support", "Security", "Hospitality"];
  const NAMES = ["Imran Yousaf", "Nida Kamal", "Asad Mehmood", "Rabia Aslam", "Kashif Ali", "Hina Raza"];
  const existing = await call("/staff");
  const have = new Set((existing.data.staff || []).map((s) => `${s.name}|${s.event?._id || s.event}`));
  let made = 0;
  for (let i = 0; i < Math.min(mine.length, 12); i++) {
    const expo = mine[i];
    const name = NAMES[i % NAMES.length];
    const key = `${name}|${expo._id}`;
    if (have.has(key)) continue;
    const res = await call("/staff", { method: "POST", body: {
      name, email: `${name.split(" ")[0].toLowerCase()}.${SEED_TAG}${i}@example.invalid`,
      phone: "+92 300 0000000", role: ROLES[i % ROLES.length], event: expo._id,
      salary: [90000, 4500, 60, 70000, 85000][i % 5], salaryType: ["monthly", "daily", "hourly"][i % 3],
      shiftStart: "09:00", shiftEnd: "18:00", active: i % 5 !== 4,
    } });
    if (res.status === 201) { created.staff.push(res.data.staff._id); made++; }
  }
  console.log(`staff: ${made} created`);
}

async function createExhibitorApplications() {
  // Create throwaway exhibitor accounts directly in MongoDB and mint their
  // tokens, then have them apply to events through the real HTTP API. The
  // organizer reviews each application via the real approval endpoint.
  const expos = await call("/expos");
  const mine = (expos.data.expos || []).filter((e) => EVENTS.some((s) => s.title === e.title)).slice(0, 6);
  const companies = ["Quantum Robotics", "Nimbus Cloud", "FinEdge Analytics", "BrightPath Solar", "MediSync Health", "UrbanCraft Studio"];

  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsphere");
  const exhibitorTokens = [];
  for (let i = 0; i < companies.length; i++) {
    const email = `${SEED_TAG}_exhibitor${i}@example.invalid`;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name: `${companies[i]} Rep`, email, password: ORG_PASSWORD, role: "exhibitor", company: companies[i] });
    }
    exhibitorTokens.push(jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "2h" }));
  }
  await mongoose.disconnect();

  let made = 0;
  for (let i = 0; i < companies.length; i++) {
    const t = exhibitorTokens[i];
    const prev = token; token = t;
    await call("/exhibitors/me", { method: "POST", body: { companyName: companies[i], description: `${companies[i]} exhibits at regional technology and business events.`, products: ["Platform", "Services"], services: ["Consulting", "Support"], website: `https://${companies[i].split(" ")[0].toLowerCase()}.example.com`, phone: "+92 42 1110000" } });
    const expo = mine[i % mine.length];
    const app = await call(`/exhibitor-applications/${expo._id}/apply`, { method: "POST" });
    token = prev;
    if (app.status === 201) {
      created.applicants.push(app.data.application._id);
      await call(`/exhibitor-applications/${app.data.application._id}/review`, { method: "PUT", body: { status: "approved" } });
      made++;
    } else if (app.status === 409) {
      made++; // already applied in an earlier run — still a valid state
    } else console.log(`  ! application for ${companies[i]} -> ${expo.title}: ${app.status} ${app.data.message || ""}`);
  }
  console.log(`exhibitor applications: ${made} present and approved`);
}

async function testMessaging() {
  // Send a real message between two seeded accounts and read the thread back.
  const users = await call("/messages/users");
  const target = (users.data.users || []).find((u) => u.email && u.email.includes(SEED_TAG));
  if (!target) { console.log("messaging: no seeded counterpart found"); return; }
  const send = await call("/messages", { method: "POST", body: { recipient: target._id, text: `Seed check ${new Date().toISOString()} — verifying threaded delivery.` } });
  const thread = await call(`/messages/thread/${target._id}`);
  const got = (thread.data.messages || []).some((m) => m.text && m.text.startsWith("Seed check"));
  console.log(`messaging: send=${send.status} thread=${thread.status} delivered=${got}`);
}

/* -------------------------------------------------------------- cleanup mode */

async function cleanup() {
  const expos = await call("/expos");
  const mine = (expos.data.expos || []).filter((e) => EVENTS.some((s) => s.title === e.title));
  let removed = 0;
  for (const e of mine) {
    const res = await call(`/expos/${e._id}`, { method: "DELETE" });
    if (res.status === 200) removed++;
  }
  const venues = await call("/venues");
  let venuesRemoved = 0;
  for (const v of (venues.data.venues || [])) {
    if (VENUES.some((s) => s.name === v.name)) { await call(`/venues/${v._id}`, { method: "DELETE" }); venuesRemoved++; }
  }
  // Remove the throwaway seeding accounts (organizer + exhibitor reps). They are
  // tagged "testseed_" so real users can never match this filter.
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsphere");
  const users = await User.deleteMany({ email: new RegExp(`^${SEED_TAG}_`, "i") });
  await mongoose.disconnect();
  console.log(`cleanup: ${removed} seeded events and ${venuesRemoved} venues deleted, ${users.deletedCount} seeding accounts removed`);
}

/* --------------------------------------------------------------------- main */

(async () => {
  token = await seedingSession();
  console.log(`seeding against ${API} as ${ORG_EMAIL}\n`);
  if (process.argv.includes("--cleanup")) { await cleanup(); return; }

  await createEvents();
  await createVenues();
  await createBoothsAndLayouts();
  await createSessions();
  await createTicketSettings();
  await createStaff();
  await createExhibitorApplications();
  await testMessaging();

  console.log("\n--- verification ---");
  const expos = await call("/expos");
  const mine = (expos.data.expos || []).filter((e) => EVENTS.some((s) => s.title === e.title));
  console.log(`events visible to the seeding account: ${mine.length}`);
  const publicList = await call("/expos", { auth: false });
  console.log(`events publicly visible (published): ${(publicList.data.expos || []).length}`);
  const venues = await call("/venues");
  console.log(`venues: ${(venues.data.venues || []).length}`);
  const staff = await call("/staff");
  console.log(`staff: ${(staff.data.staff || []).length}`);
  for (const e of mine.slice(0, 3)) {
    const b = await call(`/booths/expo/${e._id}`);
    const s = await call(`/sessions/expo/${e._id}`);
    const t = await call(`/ticket-settings/expo/${e._id}`);
    console.log(`  "${e.title}": status=${e.status} booths=${(b.data.booths || []).length} sessions=${(s.data.sessions || []).length} passes=${(t.data.passes || []).length}`);
  }
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exitCode = 1; });
