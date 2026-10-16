import FinanceTransaction from "../models/FinanceTransaction.js";
import Expo from "../models/Expo.js";
import { asyncHandler, parseDateRange, sanitizeText, oneOf, isObjectId } from "../utils/validation.js";
import { toCsv } from "../utils/csv.js";
import { recordActivity } from "../utils/activity.js";

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "INR"];

async function loadExpo(user, expoId) {
  if (!isObjectId(expoId)) return { error: 400, message: "A valid event is required." };
  const expo = await Expo.findById(expoId).select("_id title createdBy");
  if (!expo) return { error: 404, message: "Event not found." };
  if (user.role !== "admin" && String(expo.createdBy) !== String(user._id)) {
    return { error: 403, message: "You can only manage budgets for your own events." };
  }
  return { expo };
}

function dateFilter(from, to) {
  if (!from && !to) return {};
  return { date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } };
}

async function summarize(expoId) {
  const [byType, byCategory] = await Promise.all([
    FinanceTransaction.aggregate([
      { $match: { expo: expoId } },
      { $group: { _id: { type: "$type", entryType: "$entryType" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    FinanceTransaction.aggregate([
      { $match: { expo: expoId, type: "expense" } },
      { $group: { _id: { category: "$category", entryType: "$entryType" }, total: { $sum: "$amount" } } },
    ]),
  ]);

  const totals = { income: 0, plannedExpense: 0, actualExpense: 0 };
  byType.forEach((row) => {
    if (row._id.type === "income") totals.income += row.total;
    else if (row._id.entryType === "planned") totals.plannedExpense += row.total;
    else totals.actualExpense += row.total;
  });

  const categories = {};
  byCategory.forEach((row) => {
    const key = row._id.category || "Uncategorised";
    categories[key] = categories[key] || { planned: 0, actual: 0 };
    if (row._id.entryType === "planned") categories[key].planned += row.total;
    else categories[key].actual += row.total;
  });

  return {
    currency: "PKR",
    totals: {
      ...totals,
      net: totals.income - totals.actualExpense,
      remaining: totals.plannedExpense - totals.actualExpense,
    },
    categories,
  };
}

// GET /api/budget?expo=&from=&to=&entryType=&type=
export const list = asyncHandler(async (req, res) => {
  const access = await loadExpo(req.user, req.query.expo);
  if (access.error) return res.status(access.error).json({ success: false, message: access.message });

  const range = parseDateRange(req.query);
  if (!range.valid) return res.status(400).json({ success: false, message: "Invalid date range." });

  const filter = { expo: access.expo._id, ...dateFilter(range.from, range.to) };
  if (req.query.entryType && oneOf(req.query.entryType, ["planned", "actual"])) filter.entryType = req.query.entryType;
  if (req.query.type && oneOf(req.query.type, ["income", "expense"])) filter.type = req.query.type;

  const items = await FinanceTransaction.find(filter).sort({ date: -1, createdAt: -1 }).limit(1000).lean();
  const summary = await summarize(access.expo._id);
  res.json({ success: true, items, summary, event: { id: access.expo._id, title: access.expo.title } });
});

// POST /api/budget
export const create = asyncHandler(async (req, res) => {
  const { expo, type, entryType = "actual", category, description, amount, currency = "PKR", date, reference } = req.body || {};
  const access = await loadExpo(req.user, expo);
  if (access.error) return res.status(access.error).json({ success: false, message: access.message });
  if (!oneOf(type, ["income", "expense"])) return res.status(400).json({ success: false, message: "Type must be income or expense." });
  if (!oneOf(entryType, ["planned", "actual"])) return res.status(400).json({ success: false, message: "Entry type must be planned or actual." });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ success: false, message: "Amount must be a positive number." });
  const cur = String(currency).toUpperCase().trim();
  if (!CURRENCIES.includes(cur)) return res.status(400).json({ success: false, message: `Unsupported currency. Allowed: ${CURRENCIES.join(", ")}.` });

  const item = await FinanceTransaction.create({
    expo: access.expo._id,
    type,
    entryType,
    category: sanitizeText(category, 100),
    description: sanitizeText(description, 500),
    amount: Math.round(amt * 100) / 100,
    currency: cur,
    date: date ? new Date(date) : new Date(),
    reference: sanitizeText(reference, 80),
    createdBy: req.user._id,
  });

  await recordActivity({
    actor: req.user._id,
    actorName: req.user.name,
    action: "created",
    entityType: "Budget",
    entityId: item._id,
    expo: access.expo._id,
    summary: `${entryType === "planned" ? "Planned" : "Recorded"} ${type} of ${cur} ${item.amount}${item.category ? ` — ${item.category}` : ""}`,
    meta: { type, entryType, amount: item.amount, currency: cur },
  });

  res.status(201).json({ success: true, item });
});

// PUT /api/budget/:id
export const update = asyncHandler(async (req, res) => {
  const item = await FinanceTransaction.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: "Budget entry not found." });
  const access = await loadExpo(req.user, item.expo);
  if (access.error) return res.status(access.error).json({ success: false, message: access.message });

  const patch = {};
  if (req.body.type !== undefined) {
    if (!oneOf(req.body.type, ["income", "expense"])) return res.status(400).json({ success: false, message: "Invalid type." });
    patch.type = req.body.type;
  }
  if (req.body.entryType !== undefined) {
    if (!oneOf(req.body.entryType, ["planned", "actual"])) return res.status(400).json({ success: false, message: "Invalid entry type." });
    patch.entryType = req.body.entryType;
  }
  if (req.body.amount !== undefined) {
    const amt = Number(req.body.amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    patch.amount = Math.round(amt * 100) / 100;
  }
  if (req.body.currency !== undefined) {
    const cur = String(req.body.currency).toUpperCase().trim();
    if (!CURRENCIES.includes(cur)) return res.status(400).json({ success: false, message: "Unsupported currency." });
    patch.currency = cur;
  }
  if (req.body.category !== undefined) patch.category = sanitizeText(req.body.category, 100);
  if (req.body.description !== undefined) patch.description = sanitizeText(req.body.description, 500);
  if (req.body.reference !== undefined) patch.reference = sanitizeText(req.body.reference, 80);
  if (req.body.date !== undefined) patch.date = new Date(req.body.date);

  Object.assign(item, patch);
  await item.save();

  await recordActivity({
    actor: req.user._id,
    actorName: req.user.name,
    action: "updated",
    entityType: "Budget",
    entityId: item._id,
    expo: item.expo,
    summary: `Updated budget entry ${item.category || item.description || item._id}`,
    meta: { changes: Object.keys(patch) },
  });

  res.json({ success: true, item });
});

// DELETE /api/budget/:id
export const remove = asyncHandler(async (req, res) => {
  const item = await FinanceTransaction.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: "Budget entry not found." });
  const access = await loadExpo(req.user, item.expo);
  if (access.error) return res.status(access.error).json({ success: false, message: access.message });

  const snapshot = { type: item.type, entryType: item.entryType, amount: item.amount, currency: item.currency, category: item.category };
  await item.deleteOne();

  await recordActivity({
    actor: req.user._id,
    actorName: req.user.name,
    action: "deleted",
    entityType: "Budget",
    entityId: req.params.id,
    expo: access.expo._id,
    summary: `Deleted budget entry ${snapshot.category || snapshot.type} of ${snapshot.currency} ${snapshot.amount}`,
    meta: snapshot,
  });

  res.json({ success: true });
});

// GET /api/budget/export.csv?expo=
export const exportCsv = asyncHandler(async (req, res) => {
  const access = await loadExpo(req.user, req.query.expo);
  if (access.error) return res.status(access.error).json({ success: false, message: access.message });

  const items = await FinanceTransaction.find({ expo: access.expo._id }).sort({ date: -1 }).lean();
  const csv = toCsv(
    [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "entryType", label: "Planned/Actual" },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "currency", label: "Currency" },
    ],
    items.map((i) => ({ ...i, date: i.date ? new Date(i.date).toISOString().slice(0, 10) : "" }))
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="eventsphere-budget.csv"');
  res.send(csv);
});
