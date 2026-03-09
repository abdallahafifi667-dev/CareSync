const { getUserWalletModel } = require("../../models/users-core/users.models");

const COMMISSION_RATE = 0.08;
const COMMISSION_DEBT_THRESHOLD = 10;
const COMMISSION_OPERATION_THRESHOLD = 10;
const CANCELLATION_FEE_PERCENTAGE = 0.1;
const CANCELLATION_TIME_WINDOW_MINUTES = 30;
const PREMIUM_SAFETY_FEE = 1;

/**
 * Calculate 5% commission on order price
 * @param {number} orderPrice - Order price in currency
 * @returns {number} - Commission amount (5% of price)
 */
function calculateCommission(orderPrice) {
  return parseFloat((orderPrice * COMMISSION_RATE).toFixed(2));
}

/**
 * Calculate cancellation fee (10% of order price)
 * @param {number} orderPrice - Order price in currency
 * @returns {number} - Cancellation fee (10% of price)
 */
function calculateCancellationFee(orderPrice) {
  return parseFloat((orderPrice * CANCELLATION_FEE_PERCENTAGE).toFixed(2));
}

/**
 * Check if cancellation fee should be applied based on trip time
 * @param {Date} tripDate - Scheduled trip date/time
 * @param {Date} cancelDate - Cancel request date/time (default: now)
 * @returns {boolean} - true if fee should apply
 */
function shouldApplyCancellationFee(tripDate, cancelDate = new Date()) {
  const timeUntilTrip = tripDate.getTime() - cancelDate.getTime();
  const minutesUntilTrip = timeUntilTrip / (1000 * 60);
  return minutesUntilTrip <= CANCELLATION_TIME_WINDOW_MINUTES;
}

/**
 * Add commission to user's debt and track operation count
 * @param {string|Object} userIdOrDoc - User ID or object containing _id
 * @param {number} commission - Commission amount
 */
async function addCommissionDebt(userIdOrDoc, commission) {
  try {
    const userId = userIdOrDoc._id || userIdOrDoc;
    const UserWallet = getUserWalletModel();

    // Using atomic increment for safety
    const updatedWallet = await UserWallet.findOneAndUpdate(
      { userId: userId },
      {
        $inc: {
          commissionDebt: commission,
          commissionOperationCount: 1,
        },
      },
      { new: true, upsert: true }, // Upsert ensures wallet creation if missing
    );

    if (
      updatedWallet.commissionDebt >= COMMISSION_DEBT_THRESHOLD ||
      updatedWallet.commissionOperationCount >= COMMISSION_OPERATION_THRESHOLD
    ) {
      console.error(`Commission threshold reached for user ${userId}`, {
        debt: updatedWallet.commissionDebt,
        operationCount: updatedWallet.commissionOperationCount,
      });
    }
  } catch (err) {
    console.error("Failed to add commission debt", {
      error: err && err.message,
    });
    throw err;
  }
}

/**
 * Apply cancellation penalty to the canceller and compensate the damaged party
 * @param {string|Object} cancellerIdOrDoc - User ID who cancelled
 * @param {number} fee - Penalty fee amount
 * @param {string|Object} damagedIdOrDoc - User ID who gets compensated
 */
async function handleCancellationPenalty(cancellerIdOrDoc, fee, damagedIdOrDoc) {
  try {
    const cancellerId = cancellerIdOrDoc._id || cancellerIdOrDoc;
    const damagedId = damagedIdOrDoc._id || damagedIdOrDoc;
    const UserWallet = getUserWalletModel();

    await Promise.all([
      // Penalize canceller (increase their debt)
      UserWallet.findOneAndUpdate(
        { userId: cancellerId },
        { $inc: { commissionDebt: fee } },
        { upsert: true },
      ),
      // Compensate damaged party (increase their balance)
      UserWallet.findOneAndUpdate(
        { userId: damagedId },
        { $inc: { balance: fee } },
        { upsert: true },
      ),
    ]);

    console.error("Cancellation penalty/compensation applied", {
      canceller: cancellerId,
      damaged: damagedId,
      fee: fee,
    });
  } catch (err) {
    console.error("Failed to apply cancellation penalty", {
      error: err && err.message,
    });
    throw err;
  }
}

/**
 * Clear commission debt after payment
 * @param {string|Object} userIdOrDoc - User ID or doc
 */
async function clearCommissionDebt(userIdOrDoc) {
  try {
    const userId = userIdOrDoc._id || userIdOrDoc;
    const UserWallet = getUserWalletModel();

    await UserWallet.findOneAndUpdate(
      { userId: userId },
      {
        $set: {
          commissionDebt: 0,
          commissionOperationCount: 0,
          lastCommissionPaymentDate: new Date(),
        },
      },
      { upsert: true },
    );

    console.error(`Commission debt cleared for user ${userId}`, {
      userId: userId,
    });
  } catch (err) {
    console.error("Failed to clear commission debt", {
      error: err && err.message,
    });
    throw err;
  }
}

/**
 * Deduct credits from user's wallet
 * @param {string|Object} userIdOrDoc - User ID
 * @param {number} amount - Number of credits to deduct
 */
async function deductCredits(userIdOrDoc, amount) {
  try {
    const userId = userIdOrDoc._id || userIdOrDoc;
    const UserWallet = getUserWalletModel();

    const result = await UserWallet.findOneAndUpdate(
      { userId: userId, credits: { $gte: amount } },
      { $inc: { credits: -amount } },
      { new: true }
    );

    if (!result) {
      throw new Error("Insufficient credits or wallet not found");
    }

    console.error(`Deducted ${amount} credits from user ${userId}`);
    return result;
  } catch (err) {
    console.error("Failed to deduct credits", { error: err.message });
    throw err;
  }
}

/**
 * Check if user can book next trip (no outstanding debt and sufficient credits)
 * @param {Object} wallet - UserWallet document
 * @param {number} requiredCredits - Credits needed for requested safety plan
 * @returns {Object} - { canBook: boolean, reason?: string, amount?: number }
 */
function canUserBookTrip(wallet, requiredCredits = 0) {
  // Handle case where null/undefined passed
  if (!wallet) return { canBook: requiredCredits <= 0 };

  // 1. Check for credits if required
  if (requiredCredits > 0 && (!wallet.credits || wallet.credits < requiredCredits)) {
    return {
      canBook: false,
      reason: "INSUFFICIENT_CREDITS",
      amount: requiredCredits,
    };
  }

  // 2. Check for commission debt
  if (wallet.commissionDebt && wallet.commissionDebt >= COMMISSION_DEBT_THRESHOLD) {
    return {
      canBook: false,
      reason: "COMMISSION_DEBT_THRESHOLD",
      amount: wallet.commissionDebt,
    };
  }

  if (
    wallet.commissionOperationCount &&
    wallet.commissionOperationCount >= COMMISSION_OPERATION_THRESHOLD
  ) {
    return {
      canBook: false,
      reason: "COMMISSION_OPERATIONS_THRESHOLD",
      count: wallet.commissionOperationCount,
      amount: wallet.commissionDebt,
    };
  }

  if (wallet.targetAccount && wallet.targetAccount >= 10) {
    return {
      canBook: false,
      reason: "LEGACY_DEBT_LIMIT",
      amount: wallet.targetAccount,
    };
  }

  return { canBook: true };
}

module.exports = {
  COMMISSION_RATE,
  COMMISSION_DEBT_THRESHOLD,
  COMMISSION_OPERATION_THRESHOLD,
  CANCELLATION_FEE_PERCENTAGE,
  CANCELLATION_TIME_WINDOW_MINUTES,
  PREMIUM_SAFETY_FEE,
  calculateCommission,
  calculateCancellationFee,
  shouldApplyCancellationFee,
  handleCancellationPenalty,
  clearCommissionDebt,
  deductCredits,
  canUserBookTrip,
};
