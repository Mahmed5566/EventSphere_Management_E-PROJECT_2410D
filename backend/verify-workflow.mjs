/**
 * EventSphere — end-to-end workflow verification against a running backend.
 *
 * Exercises the complete real path with real HTTP calls and real MongoDB state:
 *   organizer creates event → configures passes → attendee buys → attendee sees
 *   the order → attendee cannot check in → organizer/staff checks in →
 *   duplicate check-in refused → unpaid ticket refused → forged token refused →
 *   refund/cancel releases stock → capacity restored.
 *
 * Also verifies least-privilege for all four roles on the organizer endpoints.
 *
 * Safety: creates its own throwaway accounts and one probe event, and removes
 * them all at the end. Existing events, users and orders are never modified.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
dotenv.config();

import User from "./models/User.js";
import Expo from "./models/Expo.js";
import Booth from "./models/Booth.js";
import Session from "./models/Session.js";
import TicketOrder from "./models/TicketOrder.js";
import TicketSetting from "./models/TicketSetting.js";
import CheckIn from "./models/CheckIn.js";
import Staff from "./models/Staff.js";

const API = process.env.TEST_API || "http://localhost:5000/api";
const TAG = `e2e_${Date.now().toString(36)}`;
const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
};

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const ids = { users: [], expos: [], orders: [] };
const mint = (user, hours = 2) => jwt.sign({ id: user._id, sessionVersion: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: `${hours}h` });

await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsphere");

// ---- accounts (created directly so the auth rate limiter is never abused) ----
async function mkUser(role, extra = {}) {
  const u = await User.create({ name: `E2E ${role}`, email: `${TAG}_${role}@example.invalid`, password: "E2ePass123!", role, ...extra });
  ids.users.push(u._id);
  return { user: u, token: mint(u) };
}
const org = await mkUser("organizer", { organizerKey: `e2e-${TAG}`, company: "E2E Events" });
const attendee = await mkUser("attendee");
const staff = await mkUser("staff", { company: "E2E Events" });
const exhibitor = await mkUser("exhibitor", { company: "E2E Exhibits" });
const admin = await mkUser("admin");

console.log(`\n--- A. organizer creates an event and configures passes ---`);
const created = await api("/expos", { method: "POST", token: org.token, body: {
  title: `E2E Workflow Event ${TAG}`,
  date: new Date(Date.now() + 30 * 86400000).toISOString(),
  endDate: new Date(Date.now() + 31 * 86400000).toISOString(),
  location: "E2E Test Hall",
  theme: "Verification",
  description: "Throwaway event used to verify the full ticket lifecycle.",
  status: "published",
} });
const expoId = created.data.expo?._id;
ids.expos.push(expoId);
ok("organizer creates a published event", created.status === 201 && !!expoId, `status=${created.status}`);

const setPasses = await api("/ticket-settings", { method: "POST", token: org.token, body: {
  expo: expoId,
  passes: [
    { name: "Classic Pass", price: 2000, capacity: 3, sold: 0, enabled: true },
    { name: "VIP Pass", price: 8000, capacity: 1, sold: 0, enabled: true },
    { name: "Pro Pass", price: 5000, capacity: 0, sold: 0, enabled: false },
  ],
} });
ok("organizer configures a pass ladder", setPasses.status === 201, `status=${setPasses.status}`);

// a disabled pass must never be sellable
{
  const r = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: expoId, passType: "Pro Pass", quantity: 1 } });
  ok("disabled pass cannot be purchased", r.status >= 400, `status=${r.status} :: ${r.data.message || ""}`);
}

console.log(`\n--- B. attendee sees the public pass list and buys ---`);
{
  const r = await api(`/ticket-settings/expo/${expoId}`, { token: attendee.token });
  const names = (r.data.passes || []).map(p => p.name);
  ok("attendee can read the purchasable pass list", r.status === 200 && names.includes("Classic Pass") && names.includes("VIP Pass"), `status=${r.status} passes=${names.join(",")}`);
  ok("attendee does not see the disabled pass", !names.includes("Pro Pass"), `passes=${names.join(",")}`);
}
let order = null;
{
  const r = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: expoId, passType: "Classic Pass", quantity: 1 } });
  order = r.data.order;
  if (order) ids.orders.push(order._id);
  ok("attendee purchases a Classic Pass", r.status === 201 && !!order, `status=${r.status} invoice=${order?.invoiceNo}`);
  // This deployment has no live gateway; the documented manual-demo path records
  // the order as paid with paymentProvider 'manual_demo'. Verified explicitly so
  // the behaviour is asserted rather than assumed.
  ok("order records the manual_demo provider (no live gateway)", order?.paymentProvider === "manual_demo", `provider=${order?.paymentProvider} status=${order?.status}`);
  ok("server computed the price from the DB, not the client", order?.total === 2000 && order?.unitPrice === 2000, `unitPrice=${order?.unitPrice} total=${order?.total}`);
  ok("order carries a QR token", !!order?.qrToken, `qrToken=${order?.qrToken ? "present" : "MISSING"}`);
}
{
  // client-supplied price must be ignored
  const r = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: expoId, passType: "Classic Pass", quantity: 1, total: 1, unitPrice: 1 } });
  if (r.data.order) ids.orders.push(r.data.order._id);
  ok("client-supplied total/unitPrice is ignored", r.status === 201 && r.data.order?.total === 2000, `total=${r.data.order?.total}`);
}
{
  const r = await api("/ticket-orders/mine", { token: attendee.token });
  const found = (r.data.tickets || []).some(t => String(t._id) === String(order._id));
  ok("attendee sees their own order in /ticket-orders/mine", r.status === 200 && found);
}

console.log(`\n--- C. stock and capacity ---`);
{
  // capacity 3: 2 are already sold, one more Classic succeeds, the next fails
  const third = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: expoId, passType: "Classic Pass", quantity: 1 } });
  if (third.data.order) ids.orders.push(third.data.order._id);
  const fourth = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: expoId, passType: "Classic Pass", quantity: 1 } });
  ok("Classic capacity 3 is enforced (3rd ok, 4th refused)", third.status === 201 && fourth.status === 409, `third=${third.status} fourth=${fourth.status}`);
  const vip1 = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: expoId, passType: "VIP Pass", quantity: 1 } });
  if (vip1.data.order) ids.orders.push(vip1.data.order._id);
  const vip2 = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: expoId, passType: "VIP Pass", quantity: 1 } });
  ok("VIP capacity 1 is enforced (1st ok, 2nd refused)", vip1.status === 201 && vip2.status === 409, `first=${vip1.status} second=${vip2.status}`);
}

console.log(`\n--- D. four-role authorization on the organizer endpoints ---`);
{
  // Writes on booths are organizer/admin only (there is no bare GET /booths).
  const boothWrite = await api(`/booths/expo/${expoId}`, { method: "POST", token: attendee.token, body: { boothNumber: "X1", size: "3x3", category: "Standard" } });
  ok("attendee is denied creating a booth (403)", boothWrite.status === 403, `status=${boothWrite.status}`);
  const boothWriteExh = await api(`/booths/expo/${expoId}`, { method: "POST", token: exhibitor.token, body: { boothNumber: "X2", size: "3x3", category: "Standard" } });
  ok("exhibitor is denied creating a booth (403)", boothWriteExh.status === 403, `status=${boothWriteExh.status}`);
  const checks = [
    ["attendee", attendee.token, ["/ticket-orders", "/staff", "/ticket-settings"]],
    ["exhibitor", exhibitor.token, ["/ticket-orders", "/staff"]],
  ];
  for (const [role, token, paths] of checks) {
    for (const p of paths) {
      const r = await api(p, { token });
      ok(`${role} is denied ${p}`, r.status === 403, `status=${r.status}`);
    }
  }
  // staff and organizer may list orders; attendee may not
  const orgOrders = await api("/ticket-orders", { token: org.token });
  ok("organizer can list orders", orgOrders.status === 200 && Array.isArray(orgOrders.data.tickets), `status=${orgOrders.status}`);
  const staffOrders = await api("/ticket-orders", { token: staff.token });
  ok("staff cannot list the full order book (least privilege)", staffOrders.status === 403, `status=${staffOrders.status}`);
  const anonOrders = await api("/ticket-orders");
  ok("anonymous cannot list orders", [401, 403].includes(anonOrders.status), `status=${anonOrders.status}`);
}

console.log(`\n--- E. an unpaid ticket is never valid for entry ---`);
// Create a second order and force it to 'pending' to represent an unpaid order
// (the manual-demo path records paid immediately, so we simulate the unpaid
// state that a real gateway would produce before its signed webhook arrives).
// A fresh event is used so pass capacity is guaranteed to be available.
let pendingOrder = null;
{
  const ev = await api("/expos", { method: "POST", token: org.token, body: {
    title: `E2E Unpaid Probe ${TAG}`, date: new Date(Date.now() + 40 * 86400000).toISOString(),
    location: "E2E Test Hall", description: "unpaid-order probe", status: "published",
  } });
  const unpaidExpoId = ev.data.expo?._id;
  if (unpaidExpoId) ids.expos.push(unpaidExpoId);
  await api("/ticket-settings", { method: "POST", token: org.token, body: { expo: unpaidExpoId, passes: [{ name: "Classic Pass", price: 1000, capacity: 5, sold: 0, enabled: true }] } });
  const r = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: unpaidExpoId, passType: "Classic Pass", quantity: 1 } });
  pendingOrder = r.data.order;
  if (pendingOrder) ids.orders.push(pendingOrder._id);
  await TicketOrder.updateOne({ _id: pendingOrder._id }, { $set: { status: "pending" } });
  const v = await api(`/ticket-orders/verify/${pendingOrder.qrToken}`, { token: org.token });
  ok("organizer verify reports an unpaid ticket as invalid", v.status === 200 && v.data.valid === false, `valid=${v.data.valid} orderStatus=${v.data.ticket?.status}`);
  const checkin = await api(`/ticket-orders/check-in/${pendingOrder.qrToken}`, { method: "POST", token: org.token });
  ok("checking in an unpaid ticket is refused", checkin.status === 400, `status=${checkin.status} :: ${checkin.data.message || ""}`);
  const refunded = await TicketOrder.findOneAndUpdate({ _id: pendingOrder._id }, { $set: { status: "refunded" } }, { new: true });
  const v2 = await api(`/ticket-orders/verify/${refunded.qrToken}`, { token: org.token });
  ok("a refunded ticket verifies as invalid", v2.status === 200 && v2.data.valid === false, `valid=${v2.data.valid}`);
  const c2 = await api(`/ticket-orders/check-in/${refunded.qrToken}`, { method: "POST", token: org.token });
  ok("checking in a refunded ticket is refused", c2.status === 400, `status=${c2.status}`);
}

console.log(`\n--- F. a paid ticket can be checked in, exactly once ---`);
{
  const v = await api(`/ticket-orders/verify/${order.qrToken}`, { token: org.token });
  ok("paid ticket verifies as valid", v.status === 200 && v.data.valid === true, `valid=${v.data.valid}`);
}
{
  const attacker = await api(`/ticket-orders/check-in/${order.qrToken}`, { method: "POST", token: attendee.token });
  ok("attendee cannot self-check-in (403)", attacker.status === 403, `status=${attacker.status}`);
  const other = await api(`/ticket-orders/check-in/${order.qrToken}`, { method: "POST", token: exhibitor.token });
  ok("exhibitor cannot check in (403)", other.status === 403, `status=${other.status}`);
}
{
  const c1 = await api(`/ticket-orders/check-in/${order.qrToken}`, { method: "POST", token: staff.token });
  ok("staff checks the paid ticket in successfully", c1.status === 200 && c1.data.checkin?.checkedInAt !== undefined, `status=${c1.status} :: ${c1.data.message || ""}`);
  const c2 = await api(`/ticket-orders/check-in/${order.qrToken}`, { method: "POST", token: staff.token });
  ok("duplicate check-in of the same ticket is refused (409)", c2.status === 409, `status=${c2.status} :: ${c2.data.message || ""}`);
  const c3 = await api(`/ticket-orders/check-in/${order.qrToken}`, { method: "POST", token: org.token });
  ok("a different staff member also cannot re-check-in", c3.status === 409, `status=${c3.status}`);
}
{
  const forged = await api(`/ticket-orders/check-in/not-a-real-token`, { method: "POST", token: staff.token });
  ok("a forged/unknown token is refused (404)", forged.status === 404, `status=${forged.status}`);
}

console.log(`\n--- G. cancellation releases stock back to the pool ---`);
{
  // Cancel one paid Classic ticket and confirm the freed seat can be resold.
  const paid = await TicketOrder.findOne({ expo: expoId, passType: "Classic Pass", status: "paid" });
  if (!paid) { const m = await TicketOrder.findOne({ expo: expoId, passType: "Classic Pass" }); await TicketOrder.updateOne({ _id: m._id }, { $set: { status: "paid" } }); }
  const target = await TicketOrder.findOne({ expo: expoId, passType: "Classic Pass", status: "paid" });
  const before = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: expoId, passType: "Classic Pass", quantity: 1 } });
  const beforeStatus = before.status;
  const cancel = await api(`/ticket-orders/${target._id}/cancel`, { method: "PUT", token: org.token });
  ok("organizer can cancel a paid order", cancel.status === 200 && cancel.data.order?.status === "cancelled", `status=${cancel.status}`);
  const after = await api("/ticket-orders", { method: "POST", token: attendee.token, body: { expo: expoId, passType: "Classic Pass", quantity: 1 } });
  if (after.data.order) ids.orders.push(after.data.order._id);
  ok("freed capacity becomes purchasable again", beforeStatus === 409 && after.status === 201, `before=${beforeStatus} after=${after.status}`);
}

console.log(`\n--- H. data integrity: orphan checks ---`);
{
  const setting = await TicketSetting.findOne({ expo: expoId });
  const soldClassic = setting.passes.find(p => p.name === "Classic Pass")?.sold;
  const liveOrders = await TicketOrder.countDocuments({ expo: expoId, passType: "Classic Pass", status: { $in: ["pending", "paid"] } });
  ok("stored 'sold' count matches live orders", soldClassic === liveOrders, `sold=${soldClassic} liveOrders=${liveOrders}`);
}

console.log(`\n--- cleanup ---`);
const delOrders = await TicketOrder.deleteMany({ _id: { $in: ids.orders } });
await CheckIn.deleteMany({ ticket: { $in: ids.orders } });
await TicketSetting.deleteMany({ expo: { $in: ids.expos } });
await Booth.deleteMany({ expo: { $in: ids.expos } });
await Session.deleteMany({ expo: { $in: ids.expos } });
await Staff.deleteMany({ event: { $in: ids.expos } });
await Expo.deleteMany({ _id: { $in: ids.expos } });
await User.deleteMany({ email: new RegExp(`^${TAG}_`, "i") });
console.log(`removed ${delOrders.deletedCount} orders, ${ids.expos.length} event(s), ${ids.users.length} accounts`);

await mongoose.disconnect();

console.log(`\n===== SUMMARY =====`);
const failed = results.filter(r => !r.pass);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILED:");
  failed.forEach(f => console.log(` - ${f.name} ${f.detail}`));
  process.exitCode = 1;
}
