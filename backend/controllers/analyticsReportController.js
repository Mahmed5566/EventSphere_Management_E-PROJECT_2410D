import Expo from "../models/Expo.js";
import Booth from "../models/Booth.js";
import Venue from "../models/Venue.js";
import ExpoRegistration from "../models/ExpoRegistration.js";
import Session from "../models/Session.js";
import TicketOrder from "../models/TicketOrder.js";
import CheckIn from "../models/CheckIn.js";
import TicketSetting from "../models/TicketSetting.js";
import { buildReportPdf } from "../utils/pdfReport.js";
import { toCsv } from "../utils/csv.js";
import { asyncHandler, parseDateRange } from "../utils/validation.js";

const DAY = 24 * 60 * 60 * 1000;

// Resolve the set of events the caller may report on.
// admin  -> every event (ids === null means "no expo filter")
// organizer -> only events they created
// explicit ?expo= is validated against ownership.
async function resolveScope(user, expoId) {
  if (expoId) {
    const expo = await Expo.findById(expoId).select("_id createdBy title date endDate location");
    if (!expo) return { error: 404, message: "Event not found." };
    if (user.role !== "admin" && String(expo.createdBy) !== String(user._id)) {
      return { error: 403, message: "You can only view reports for your own events." };
    }
    return { ids: [expo._id], expo };
  }
  if (user.role === "admin") return { ids: null, expo: null };
  const expos = await Expo.find({ createdBy: user._id }).select("_id");
  return { ids: expos.map((e) => e._id), expo: null };
}

function idMatch(field, ids) {
  return ids ? { [field]: { $in: ids } } : {};
}

function dateMatch(field, from, to) {
  const range = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return from || to ? { [field]: range } : {};
}

async function buildSummary({ ids, from, to, user }) {
  const expoFilter = ids ? { _id: { $in: ids } } : {};
  const regFilter = { ...idMatch("expo", ids), ...dateMatch("createdAt", from, to) };
  const ticketFilter = { status: "paid", ...idMatch("expo", ids), ...dateMatch("createdAt", from, to) };
  const checkinFilter = { ...idMatch("expo", ids), ...dateMatch("checkedInAt", from, to) };
  const boothFilter = idMatch("expo", ids);

  const [
    events,
    eventsByStatus,
    registrations,
    registrationsByType,
    paidOrders,
    checkins,
    boothsByStatus,
    sessions,
    venues,
    settings,
  ] = await Promise.all([
    Expo.countDocuments(expoFilter),
    Expo.aggregate([{ $match: expoFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ExpoRegistration.countDocuments(regFilter),
    ExpoRegistration.aggregate([{ $match: regFilter }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
    TicketOrder.find(ticketFilter).select("expo quantity total passType createdAt"),
    CheckIn.countDocuments(checkinFilter),
    Booth.aggregate([{ $match: boothFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Session.countDocuments(idMatch("expo", ids)),
    Venue.countDocuments(user && user.role !== "admin" ? { owner: user._id } : {}),
    TicketSetting.find(idMatch("expo", ids)).select("passes"),
  ]);

  const ticketsSold = paidOrders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);
  const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const byType = {};
  registrationsByType.forEach((r) => {
    byType[r._id || "unknown"] = r.count;
  });
  const status = {};
  eventsByStatus.forEach((r) => {
    status[r._id || "unknown"] = r.count;
  });
  const boothStatus = {};
  boothsByStatus.forEach((r) => {
    boothStatus[r._id || "unknown"] = r.count;
  });

  // Ticket inventory: capacity 0 means "not configured / unlimited" and is
  // reported as unavailable rather than as a genuine zero.
  let capacityTotal = 0;
  let soldTotal = 0;
  let inventoryConfigured = false;
  settings.forEach((s) => {
    (s.passes || []).forEach((p) => {
      if (Number(p.capacity) > 0) inventoryConfigured = true;
      capacityTotal += Number(p.capacity || 0);
      soldTotal += Number(p.sold || 0);
    });
  });

  // Daily time series within the requested window (defaults to last 30 days).
  const seriesFrom = from || new Date(Date.now() - 30 * DAY);
  const seriesTo = to || new Date();
  const [ticketSeries, regSeries] = await Promise.all([
    TicketOrder.aggregate([
      { $match: { status: "paid", ...idMatch("expo", ids), createdAt: { $gte: seriesFrom, $lte: seriesTo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, tickets: { $sum: "$quantity" }, revenue: { $sum: "$total" } } },
      { $sort: { _id: 1 } },
    ]),
    ExpoRegistration.aggregate([
      { $match: { ...idMatch("expo", ids), createdAt: { $gte: seriesFrom, $lte: seriesTo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, registrations: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const seriesMap = new Map();
  ticketSeries.forEach((r) => seriesMap.set(r._id, { date: r._id, tickets: r.tickets || 0, revenue: r.revenue || 0, registrations: 0 }));
  regSeries.forEach((r) => {
    const row = seriesMap.get(r._id) || { date: r._id, tickets: 0, revenue: 0, registrations: 0 };
    row.registrations = r.registrations || 0;
    seriesMap.set(r._id, row);
  });
  const timeseries = [...seriesMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    events: { total: events, byStatus: status },
    registrations: { total: registrations, byType },
    tickets: {
      paidOrders: paidOrders.length,
      ticketsSold,
      checkins,
      revenue,
      attendanceRate: ticketsSold > 0 ? Math.round((checkins / ticketsSold) * 1000) / 10 : null,
    },
    inventory: {
      configured: inventoryConfigured,
      capacity: inventoryConfigured ? capacityTotal : null,
      sold: inventoryConfigured ? soldTotal : null,
      available: inventoryConfigured ? Math.max(0, capacityTotal - soldTotal) : null,
    },
    operations: { booths: boothStatus, sessions },
    venues: { total: venues },
    timeseries,
    currency: "PKR",
  };
}

// GET /api/analytics/summary?expo=&from=&to=
export const summary = asyncHandler(async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range.valid) return res.status(400).json({ success: false, message: "Invalid date range: 'from' must be before 'to'." });
  const scope = await resolveScope(req.user, req.query.expo);
  if (scope.error) return res.status(scope.error).json({ success: false, message: scope.message });

  const data = await buildSummary({ ids: scope.ids, from: range.from, to: range.to, user: req.user });
  res.json({
    success: true,
    summary: data,
    filters: {
      expo: scope.expo ? { id: scope.expo._id, title: scope.expo.title } : null,
      from: range.from,
      to: range.to,
    },
    generatedAt: new Date().toISOString(),
  });
});

async function eventRows(ids, from, to) {
  const expoFilter = ids ? { _id: { $in: ids } } : {};
  const expos = await Expo.find(expoFilter).select("title status date location");
  const [tickets, regs, checks] = await Promise.all([
    TicketOrder.aggregate([
      { $match: { status: "paid", ...idMatch("expo", ids), ...dateMatch("createdAt", from, to) } },
      { $group: { _id: "$expo", tickets: { $sum: "$quantity" }, revenue: { $sum: "$total" } } },
    ]),
    ExpoRegistration.aggregate([{ $match: { ...idMatch("expo", ids), ...dateMatch("createdAt", from, to) } }, { $group: { _id: "$expo", registrations: { $sum: 1 } } }]),
    CheckIn.aggregate([{ $match: { ...idMatch("expo", ids), ...dateMatch("checkedInAt", from, to) } }, { $group: { _id: "$expo", checkins: { $sum: 1 } } }]),
  ]);
  const tMap = new Map(tickets.map((t) => [String(t._id), t]));
  const rMap = new Map(regs.map((r) => [String(r._id), r]));
  const cMap = new Map(checks.map((c) => [String(c._id), c]));
  return expos.map((e) => {
    const t = tMap.get(String(e._id)) || {};
    const r = rMap.get(String(e._id)) || {};
    const c = cMap.get(String(e._id)) || {};
    return {
      event: e.title,
      status: e.status,
      date: e.date ? new Date(e.date).toISOString().slice(0, 10) : "",
      tickets: t.tickets || 0,
      revenue: t.revenue || 0,
      registrations: r.registrations || 0,
      checkins: c.checkins || 0,
    };
  });
}

// GET /api/analytics/breakdown?expo=&from=&to=
export const breakdown = asyncHandler(async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range.valid) return res.status(400).json({ success: false, message: "Invalid date range." });
  const scope = await resolveScope(req.user, req.query.expo);
  if (scope.error) return res.status(scope.error).json({ success: false, message: scope.message });
  const rows = await eventRows(scope.ids, range.from, range.to);
  res.json({ success: true, rows });
});

// GET /api/analytics/export.csv?expo=&from=&to=
export const exportCsv = asyncHandler(async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range.valid) return res.status(400).json({ success: false, message: "Invalid date range." });
  const scope = await resolveScope(req.user, req.query.expo);
  if (scope.error) return res.status(scope.error).json({ success: false, message: scope.message });

  const rows = await eventRows(scope.ids, range.from, range.to);
  const csv = toCsv(
    [
      { key: "event", label: "Event" },
      { key: "status", label: "Status" },
      { key: "date", label: "Date" },
      { key: "tickets", label: "Tickets Sold" },
      { key: "revenue", label: "Revenue (PKR)" },
      { key: "registrations", label: "Registrations" },
      { key: "checkins", label: "Check-ins" },
    ],
    rows
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="eventsphere-analytics.csv"');
  res.send(csv);
});

// GET /api/analytics/report.pdf?expo=&from=&to=
export const exportPdf = asyncHandler(async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range.valid) return res.status(400).json({ success: false, message: "Invalid date range." });
  const scope = await resolveScope(req.user, req.query.expo);
  if (scope.error) return res.status(scope.error).json({ success: false, message: scope.message });

  const data = await buildSummary({ ids: scope.ids, from: range.from, to: range.to, user: req.user });
  const rows = await eventRows(scope.ids, range.from, range.to);

  const fmt = (d) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) : "—");
  const meta = [
    `Generated: ${new Date().toISOString()}`,
    `Date range: ${range.from ? fmt(range.from) : "all time"} to ${range.to ? fmt(range.to) : "now"}`,
    scope.expo ? `Event: ${scope.expo.title}` : "Scope: all accessible events",
  ];
  const lines = [
    `Events: ${data.events.total}   Published: ${data.events.byStatus.published || 0}   Completed: ${data.events.byStatus.completed || 0}`,
    `Registrations: ${data.registrations.total}`,
    `Paid orders: ${data.tickets.paidOrders}   Tickets sold: ${data.tickets.ticketsSold}`,
    `Revenue (PKR): ${Number(data.tickets.revenue).toLocaleString()}`,
    `Check-ins: ${data.tickets.checkins}`,
    `Inventory: ${data.inventory.configured ? `${data.inventory.available} available of ${data.inventory.capacity}` : "not configured"}`,
  ];
  const pdf = buildReportPdf({
    title: "EventSphere — Live Analytics Report",
    meta,
    lines,
    tableHeaders: ["Event", "Tickets", "Revenue", "Regs", "Check-ins"],
    tableRows: rows.map((r) => [r.event, r.tickets, r.revenue, r.registrations, r.checkins]),
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="eventsphere-analytics-report.pdf"');
  res.send(pdf);
});

export { resolveScope, buildSummary };
