// Atomic ticket inventory helpers.
//
// The previous implementation read `pass.sold`, compared it to `pass.capacity`
// and then wrote `pass.sold += qty`. Two concurrent purchases could both pass
// the check and the last write won, so capacity could be exceeded and `sold`
// could drift away from the number of tickets actually issued.
//
// MongoDB evaluates and updates a single document atomically, so every
// inventory change now happens inside one conditional `findOneAndUpdate`:
//   - `claimTicketStock` only increments when capacity would not be exceeded
//     (capacity === 0 means "unlimited", matching the existing UI semantics).
//   - `releaseTicketStock` decrements without ever going below zero.
//
// The capacity comparison is expressed as plain numeric dot-notation filters
// (`passes.0.capacity`) resolved at call time, because `$expr`/aggregate
// operators are not allowed inside `$elemMatch` in a query position.

import TicketSetting from "../models/TicketSetting.js";

async function passIndex(expoId, passType) {
  const setting = await TicketSetting.findOne({ expo: expoId }).select("passes");
  if (!setting) return { setting: null, index: -1 };
  const index = setting.passes.findIndex((p) => p.name === passType);
  return { setting, index };
}

// Returns true when the stock was claimed, false when it was sold out or the
// pass does not exist / is disabled.
export async function claimTicketStock(expoId, passType, qty) {
  const quantity = Math.max(1, Number(qty) || 1);
  const { setting, index } = await passIndex(expoId, passType);
  if (!setting || index < 0) return false;

  const base = `passes.${index}`;
  const capacity = Number(setting.passes[index].capacity || 0);

  // capacity <= 0 means "unlimited". For limited passes the filter proves that
  // `sold + qty <= capacity` by testing `sold <= capacity - qty`, which MongoDB
  // evaluates and applies in one atomic document update.
  const filter = { expo: expoId, [`${base}.enabled`]: true };
  if (capacity > 0) {
    if (capacity - quantity < 0) return false;
    filter[`${base}.sold`] = { $lte: capacity - quantity };
  }

  const updated = await TicketSetting.findOneAndUpdate(
    filter,
    { $inc: { [`${base}.sold`]: quantity } },
    { new: true }
  );
  return Boolean(updated);
}

// Best-effort release used on cancellation/refund. Never errors the caller.
export async function releaseTicketStock(expoId, passType, qty) {
  const quantity = Math.max(0, Number(qty) || 0);
  if (!quantity) return false;
  const { setting, index } = await passIndex(expoId, passType);
  if (!setting || index < 0) return false;
  const next = Math.max(0, Number(setting.passes[index].sold || 0) - quantity);
  await TicketSetting.updateOne(
    { expo: expoId },
    { $set: { [`passes.${index}.sold`]: next } }
  );
  return true;
}

// Remaining stock for a pass (Infinity when unlimited). Used for error copy.
export async function ticketStockLeft(expoId, passType) {
  const { setting, index } = await passIndex(expoId, passType);
  if (!setting || index < 0) return { found: false, left: 0, capacity: 0, price: 0, enabled: false };
  const pass = setting.passes[index];
  const capacity = Number(pass.capacity || 0);
  const sold = Number(pass.sold || 0);
  return {
    found: true,
    left: capacity > 0 ? Math.max(0, capacity - sold) : Infinity,
    capacity,
    price: Number(pass.price || 0),
    enabled: Boolean(pass.enabled),
  };
}
