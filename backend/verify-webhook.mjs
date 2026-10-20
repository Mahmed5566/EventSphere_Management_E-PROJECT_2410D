/**
 * EventSphere — live webhook settlement verification.
 *
 * Runs against a dedicated backend instance started with throwaway Stripe env
 * vars (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET) so the REAL signature
 * verification and settlement code runs end to end. Nothing is written to .env;
 * the values are passed only in the child process environment.
 *
 * Proves:
 *   - a correctly signed webhook settles a pending order to 'paid'
 *   - a replayed webhook is idempotent (stock credited exactly once)
 *   - a tampered signature is rejected with 400 and changes nothing
 *   - checkout.session.expired returns reserved stock and cancels the order
 *   - the success-page confirm endpoint is read-only (cannot settle an order)
 */
import crypto from "crypto";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
dotenv.config();

import User from "./models/User.js";
import Expo from "./models/Expo.js";
import TicketOrder from "./models/TicketOrder.js";
import TicketSetting from "./models/TicketSetting.js";
import PaymentEvent from "./models/PaymentEvent.js";

const API = process.env.PAY_API || "http://localhost:5099/api";
const WEBHOOK_SECRET = process.env.TEST_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) { console.error("TEST_WEBHOOK_SECRET missing"); process.exit(1); }

const TAG = `wh_${Date.now().toString(36)}`;
const results = [];
const ok = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? " :: " + d : ""}`); };

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {}; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
function sign(payload, ts = Math.floor(Date.now() / 1000)) {
  return `t=${ts},v1=${crypto.createHmac("sha256", WEBHOOK_SECRET).update(`${ts}.${payload}`, "utf8").digest("hex")}`;
}
async function sendWebhook(eventObj, { tamper = false, secret = WEBHOOK_SECRET } = {}) {
  const payload = JSON.stringify(eventObj);
  const ts = Math.floor(Date.now() / 1000);
  const useSecret = tamper ? secret + "_tampered" : secret;
  const header = `t=${ts},v1=${crypto.createHmac("sha256", useSecret).update(`${ts}.${payload}`, "utf8").digest("hex")}`;
  const res = await fetch(API + "/payments/webhook", {
    method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": header }, body: payload,
  });
  let data = {}; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsphere");
const mint = (u) => jwt.sign({ id: u._id, sessionVersion: u.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "2h" });
const ids = { users: [], expos: [], orders: [], events: [] };
async function mkUser(role, extra = {}) {
  const u = await User.create({ name: `WH ${role}`, email: `${TAG}_${role}@example.invalid`, password: "WhPass123!", role, ...extra });
  ids.users.push(u._id); return { user: u, token: mint(u) };
}
const org = await mkUser("organizer", { organizerKey: `wh-${TAG}`, company: "WH Events" });
const attendee = await mkUser("attendee");

const created = await api("/expos", { method: "POST", token: org.token, body: {
  title: `Webhook Probe ${TAG}`, date: new Date(Date.now() + 15 * 86400000).toISOString(),
  location: "WH Hall", description: "webhook probe", status: "published",
} });
const expoId = created.data.expo?._id; ids.expos.push(expoId);
await api("/ticket-settings", { method: "POST", token: org.token, body: {
  expo: expoId, passes: [{ name: "Classic Pass", price: 4000, capacity: 5, sold: 0, enabled: true }],
} });

// Helper: create a real pending order directly (checkout needs a real Stripe
// network call, so we seed the pending order + session id the webhook will find).
async function makePendingOrder(sessionId) {
  const order = await TicketOrder.create({
    expo: expoId, attendee: attendee.user._id, passType: "Classic Pass",
    unitPrice: 4000, quantity: 1, total: 4000, status: "pending",
    paymentProvider: "stripe", paymentSessionId: sessionId,
  });
  ids.orders.push(order._id);
  // Claim stock the way checkout does.
  const s = await TicketSetting.findOne({ expo: expoId });
  const p = s.passes.find((x) => x.name === "Classic Pass"); p.sold += 1; await s.save();
  return order;
}
const soldCount = async () => (await TicketSetting.findOne({ expo: expoId })).passes.find((p) => p.name === "Classic Pass").sold;

console.log(`\n--- A. correctly signed checkout.session.completed settles the order ---`);
const sessionId = `cs_test_${crypto.randomBytes(8).toString("hex")}`;
await makePendingOrder(sessionId);
{
  const before = await soldCount();
  const evt = { id: `evt_${TAG}_1`, type: "checkout.session.completed", livemode: false,
    data: { object: { id: sessionId, object: "checkout.session", payment_status: "paid", amount_total: 400000, metadata: {} } } };
  const r = await sendWebhook(evt);
  ok("signed webhook accepted", r.status === 200 && r.data.received, `status=${r.status}`);
  const order = await TicketOrder.findOne({ paymentSessionId: sessionId });
  ok("order settled to paid", order.status === "paid", `status=${order.status}`);
  ok("ticket QR + invoice issued by the webhook", !!order.qrToken && !!order.invoiceNo, `qr=${!!order.qrToken} invoice=${order.invoiceNo}`);
  ok("stock was not double-credited by settlement", (await soldCount()) === before, `sold=${await soldCount()} (claimed at checkout)`);
}

console.log(`\n--- B. replaying the same event is idempotent ---`);
{
  const evt = { id: `evt_${TAG}_1`, type: "checkout.session.completed", livemode: false,
    data: { object: { id: sessionId, object: "checkout.session", payment_status: "paid", amount_total: 400000, metadata: {} } } };
  const r = await sendWebhook(evt);
  ok("replay acknowledged as duplicate", r.status === 200 && r.data.duplicate === true, `status=${r.status} duplicate=${r.data.duplicate}`);
  const events = await PaymentEvent.countDocuments({ eventId: `evt_${TAG}_1` });
  ok("exactly one PaymentEvent recorded", events === 1, `count=${events}`);
}

console.log(`\n--- C. a tampered signature is rejected and changes nothing ---`);
{
  const sid2 = `cs_test_${crypto.randomBytes(8).toString("hex")}`;
  const order = await makePendingOrder(sid2);
  const evt = { id: `evt_${TAG}_tamper`, type: "checkout.session.completed", livemode: false,
    data: { object: { id: sid2, object: "checkout.session", payment_status: "paid", amount_total: 400000, metadata: {} } } };
  const r = await sendWebhook(evt, { tamper: true });
  ok("tampered signature rejected with 400", r.status === 400, `status=${r.status} :: ${r.data.message || ""}`);
  const after = await TicketOrder.findById(order._id);
  ok("order left untouched (still pending)", after.status === "pending", `status=${after.status}`);
  const evts = await PaymentEvent.countDocuments({ eventId: `evt_${TAG}_tamper` });
  ok("no event recorded for a rejected signature", evts === 0, `count=${evts}`);
}

console.log(`\n--- D. the success-page confirm endpoint is read-only ---`);
{
  const sid3 = `cs_test_${crypto.randomBytes(8).toString("hex")}`;
  const order = await makePendingOrder(sid3);
  const r = await api(`/payments/confirm/${sid3}`, { token: attendee.token });
  ok("confirm reports not-yet-settled without settling", r.status === 200 && r.data.settled === false, `settled=${r.data.settled}`);
  const after = await TicketOrder.findById(order._id);
  ok("confirm did NOT flip the order to paid", after.status === "pending", `status=${after.status}`);
}

console.log(`\n--- E. expires abandoned checkout and returns stock ---`);
{
  const sid4 = `cs_test_${crypto.randomBytes(8).toString("hex")}`;
  const order = await makePendingOrder(sid4);
  const before = await soldCount();
  const evt = { id: `evt_${TAG}_exp`, type: "checkout.session.expired", livemode: false,
    data: { object: { id: sid4, object: "checkout.session" } } };
  const r = await sendWebhook(evt);
  ok("expired session webhook accepted", r.status === 200, `status=${r.status}`);
  const after = await TicketOrder.findById(order._id);
  ok("order cancelled on expiry", after.status === "cancelled", `status=${after.status}`);
  ok("reserved stock released", (await soldCount()) === before - 1, `sold ${before} -> ${await soldCount()}`);
}

console.log(`\n--- cleanup ---`);
await TicketSetting.deleteMany({ expo: { $in: ids.expos } });
await TicketOrder.deleteMany({ expo: { $in: ids.expos } });
await Expo.deleteMany({ _id: { $in: ids.expos } });
await PaymentEvent.deleteMany({ eventId: new RegExp(TAG) });
await User.deleteMany({ email: new RegExp(`^${TAG}_`, "i") });
console.log("probe records removed");

await mongoose.disconnect();
console.log(`\n===== SUMMARY =====`);
const failed = results.filter((r) => !r.p);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log("FAILED:"); failed.forEach((f) => console.log(` - ${f.n} ${f.d}`)); process.exitCode = 1; }
