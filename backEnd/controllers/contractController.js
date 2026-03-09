const Contract = require('../models/contract');
const asyncHandler = require('express-async-handler');
const { getUserModel } = require("../../models/users-core/users.models");
const User = getUserModel();
const NotificationService = require("../../Notification/notificationService");

/**
 * @desc    Send a contract invitation
 * @route   POST /api/contracts/invite
 * @access  private (Pharmacy or Shipping Company)
 */
exports.sendInvitation = asyncHandler(async (req, res) => {
    const { targetUserId, message, businessDetails } = req.body;

    if (!targetUserId) {
        return res.status(400).json({ message: "Please provide targetUserId" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
    }

    // Role validation: Pharmacy can invite Shipping Company and vice versa
    const isPharmacy = req.user.role === 'pharmacy';
    const isShipping = req.user.role === 'shipping_company';
    const targetIsPharmacy = targetUser.role === 'pharmacy';
    const targetIsShipping = targetUser.role === 'shipping_company';

    if (!((isPharmacy && targetIsShipping) || (isShipping && targetIsPharmacy))) {
        return res.status(400).json({ message: "Invalid invitation direction. Pharmacies can only invite shipping companies and vice versa." });
    }

    const pharmacyId = isPharmacy ? req.user._id : targetUserId;
    const shippingCompanyId = isShipping ? req.user._id : targetUserId;

    // Check if contract already exists
    const existing = await Contract.findOne({ pharmacy: pharmacyId, shippingCompany: shippingCompanyId });
    if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
        return res.status(400).json({ message: "A contract or pending invitation already exists between these parties." });
    }

    // Upsert or Create? The audio said "every pharmacy has the right to contract with a certain delivery company".
    // I'll allow multiple but usually one active.

    const contract = await Contract.create({
        pharmacy: pharmacyId,
        shippingCompany: shippingCompanyId,
        initiatedBy: req.user._id,
        message,
        businessDetails,
        status: 'pending'
    });

    // Send Notification to target
    try {
        if (targetUser.fcmTokens && targetUser.fcmTokens.length > 0) {
            await NotificationService.sendToMultipleDevices(
                targetUser.fcmTokens,
                "New Contract Invitation",
                `${req.user.username} has sent you a contract invitation for e-commerce delivery.`,
                { contractId: contract._id.toString(), type: "CONTRACT_INVITATION" }
            );
        }
    } catch (err) {
        console.error("Notification failed", err);
    }

    res.status(201).json({ message: "Invitation sent successfully", contract });
});

/**
 * @desc    Accept or Reject an invitation
 * @route   PUT /api/contracts/respond/:id
 * @access  private (Target of the invitation)
 */
exports.respondToInvitation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({ message: "Invalid action. Use 'accept' or 'reject'." });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
        return res.status(404).json({ message: "Invitation not found" });
    }

    // Only the target (the one who didn't initiate) can respond
    if (contract.initiatedBy.toString() === req.user._id.toString()) {
        return res.status(403).json({ message: "You cannot respond to your own invitation." });
    }

    // Verify user is part of the contract
    if (contract.pharmacy.toString() !== req.user._id.toString() &&
        contract.shippingCompany.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Access denied." });
    }

    if (contract.status !== 'pending') {
        return res.status(400).json({ message: `Invitation is already ${contract.status}.` });
    }

    contract.status = action === 'accept' ? 'accepted' : 'rejected';
    await contract.save();

    // Notify the initiator
    const initiator = await User.findById(contract.initiatedBy);
    try {
        if (initiator && initiator.fcmTokens && initiator.fcmTokens.length > 0) {
            await NotificationService.sendToMultipleDevices(
                initiator.fcmTokens,
                `Invitation ${action === 'accept' ? 'Accepted' : 'Rejected'}`,
                `${req.user.username} has ${action}ed your contract invitation.`,
                { contractId: contract._id.toString(), type: "CONTRACT_RESPONSE", status: contract.status }
            );
        }
    } catch (err) {
        console.error("Notification failed", err);
    }

    res.status(200).json({ message: `Invitation ${action}ed successfully`, contract });
});

/**
 * @desc    Get user's contracts/invitations
 * @route   GET /api/contracts/my-contracts
 * @access  private
 */
exports.getMyContracts = asyncHandler(async (req, res) => {
    const query = {
        $or: [
            { pharmacy: req.user._id },
            { shippingCompany: req.user._id }
        ]
    };

    const contracts = await Contract.find(query)
        .populate('pharmacy', 'username email phone avatar')
        .populate('shippingCompany', 'username email phone avatar')
        .sort({ updatedAt: -1 });

    res.status(200).json(contracts);
});
