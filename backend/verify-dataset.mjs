// Read-only verification of the seeded test dataset. Reports what a real
// attendee would see: published events, priced passes with remaining capacity.
const API = "http://localhost:5000/api";
const stamp = Date.now();

(async () => {
  const reg = await fetch(API + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Dataset Verifier", email: `verify_${stamp}@example.invalid`, password: "VerifyPass123!", role: "attendee" }),
  });
  const { token } = await reg.json();
  if (!token) { console.log("verifier signup failed", reg.status, await reg.text()); process.exitCode = 1; return; }
  const H = { Authorization: "Bearer " + token };

  const expos = await (await fetch(API + "/expos", { headers: H })).json();
  const events = expos.expos || [];
  console.log(`published events visible to an attendee: ${events.length}\n`);

  let buyable = 0, freeOnly = 0, none = 0, totalPasses = 0;
  const rows = [];
  for (const e of events) {
    const s = await (await fetch(API + "/ticket-settings/expo/" + e._id, { headers: H })).json();
    const passes = (s.passes || []).filter((p) => p.enabled !== false);
    totalPasses += passes.length;
    const paid = passes.filter((p) => Number(p.price) > 0);
    const withRoom = paid.filter((p) => Number(p.capacity) === 0 || p.capacity - (p.sold || 0) > 0);
    const label = withRoom.length
      ? withRoom.map((p) => `${p.name} PKR ${p.price}${p.capacity ? ` (${p.capacity - (p.sold || 0)} left)` : " (unlimited)"}`).join(", ")
      : passes.length ? "free passes only" : "no passes configured";
    if (withRoom.length) buyable++; else if (passes.length) freeOnly++; else none++;
    rows.push({ event: e.title, status: e.status, date: e.date ? new Date(e.date).toISOString().slice(0, 10) : "", location: e.location, passes: passes.length, sale: label });
  }

  for (const r of rows) console.log(`• ${r.event}\n    ${r.date} · ${r.location} · status=${r.status}\n    ${r.passes} pass(es): ${r.sale}`);

  console.log(`\n===== SUMMARY =====`);
  console.log(`events: ${events.length}`);
  console.log(`  with a purchasable paid pass: ${buyable}`);
  console.log(`  free-pass only: ${freeOnly}`);
  console.log(`  no passes configured: ${none}`);
  console.log(`total passes configured: ${totalPasses}`);

  // Independent counts straight from the database for cross-checking.
  const { default: mongoose } = await import("mongoose");
  const dotenv = (await import("dotenv")).default;
  dotenv.config();
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsphere");
  const Expo = (await import("./models/Expo.js")).default;
  const Booth = (await import("./models/Booth.js")).default;
  const Session = (await import("./models/Session.js")).default;
  const Staff = (await import("./models/Staff.js")).default;
  const TicketOrder = (await import("./models/TicketOrder.js")).default;
  const Venue = (await import("./models/Venue.js")).default;
  const ExhibitorApplication = (await import("./models/ExhibitorApplication.js")).default;
  console.log(`\ndatabase totals:`);
  console.log(`  expos=${await Expo.countDocuments()} venues=${await Venue.countDocuments()} booths=${await Booth.countDocuments()}`);
  console.log(`  sessions=${await Session.countDocuments()} staff=${await Staff.countDocuments()} ticketOrders=${await TicketOrder.countDocuments()} exhibitorApplications=${await ExhibitorApplication.countDocuments()}`);
  await mongoose.disconnect();
})();
