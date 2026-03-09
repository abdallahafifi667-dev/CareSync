const { getOrderModel } = require("../../models/users-core/order.models");

/**
 * Checks if two time ranges overlap.
 * @param {Date} start1
 * @param {number} duration1 (in hours)
 * @param {Date} start2
 * @param {number} duration2 (in hours)
 * @returns {boolean}
 */
function areTripsConflicting(start1, duration1, start2, duration2) {
  const s1 = new Date(start1).getTime();
  const e1 = s1 + duration1 * 60 * 60 * 1000;

  const s2 = new Date(start2).getTime();
  const e2 = s2 + duration2 * 60 * 60 * 1000;

  return s1 < e2 && s2 < e1;
}

/**
 * Automatically withdraws a provider from conflicting orders when they are confirmed for an order.
 * @param {string} providerId
 * @param {Object} confirmedOrder - The order the provider just got confirmed for
 */
async function withdrawConflicts(providerId, confirmedOrder) {
  const Order = getOrderModel();

  // Find all other orders where this provider is involved
  const otherOrders = await Order.find({
    _id: { $ne: confirmedOrder._id },
    $or: [
      { Interested: providerId },
      { "offers.provider": providerId, "offers.status": "pending" },
    ],
    status: { $in: ["open", "bidding"] },
  });

  for (const order of otherOrders) {
    if (
      areTripsConflicting(
        confirmedOrder.appointmentDate,
        confirmedOrder.duration,
        order.appointmentDate,
        order.duration,
      )
    ) {
      let modified = false;

      // Handle Interested array
      if (order.Interested.includes(providerId)) {
        order.Interested.pull(providerId);
        if (!order.WithdrawnInterested.includes(providerId)) {
          order.WithdrawnInterested.push(providerId);
        }
        modified = true;
      }

      // Handle offers array
      const offer = order.offers.find(
        (o) =>
          o.provider.toString() === providerId.toString() && o.status === "pending",
      );
      if (offer) {
        offer.status = "withdrawn_conflict";
        modified = true;
      }

      if (modified) await order.save();
    }
  }
}

/**
 * Restores a provider's interest/offers if they are no longer confirmed for a conflicting order.
 * @param {string} providerId
 */
async function restoreConflicts(providerId) {
  const Order = getOrderModel();

  // 1. Get all currently confirmed orders for this provider
  const confirmedOrders = await Order.find({
    provider: providerId,
    status: "confirmed",
  });

  // 2. Find all orders where the provider was withdrawn due to conflict
  const withdrawnOrders = await Order.find({
    $or: [
      { WithdrawnInterested: providerId },
      { "offers.provider": providerId, "offers.status": "withdrawn_conflict" },
    ],
    status: { $in: ["open", "bidding"] },
  });

  for (const order of withdrawnOrders) {
    // Check if this order still conflicts with ANY of the remaining confirmed orders
    const stillConflicts = confirmedOrders.some((confirmed) =>
      areTripsConflicting(
        confirmed.appointmentDate,
        confirmed.duration,
        order.appointmentDate,
        order.duration,
      ),
    );

    if (!stillConflicts) {
      let modified = false;

      // Restore to Interested
      if (order.WithdrawnInterested.includes(providerId)) {
        order.WithdrawnInterested.pull(providerId);
        if (!order.Interested.includes(providerId)) {
          order.Interested.push(providerId);
        }
        modified = true;
      }

      // Restore offer
      const offer = order.offers.find(
        (o) =>
          o.provider.toString() === providerId.toString() &&
          o.status === "withdrawn_conflict",
      );
      if (offer) {
        offer.status = "pending";
        modified = true;
      }

      if (modified) await order.save();
    }
  }
}

module.exports = {
  areTripsConflicting,
  withdrawConflicts,
  restoreConflicts,
};
