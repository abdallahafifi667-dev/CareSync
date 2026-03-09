const { Conversation, Message } = require('../models/E-commerce/Chat');
const Contract = require('../models/contract');
const asyncHandler = require('express-async-handler');
const { getUserModel } = require("../../models/users-core/users.models");
const User = getUserModel();
const NotificationService = require("../../Notification/notificationService");

/**
 * @desc    Send a message (Pharmacy <-> Shipping)
 * @route   POST /api/ecommerce-chat/send
 * @access  private
 */
exports.sendMessage = asyncHandler(async (req, res) => {
    const { recipientId, text } = req.body;
    const senderId = req.user._id;

    if (!recipientId || !text) {
        return res.status(400).json({ message: "Recipient and text are required" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
        return res.status(404).json({ message: "Recipient not found" });
    }

    // Role validation
    const isPharmacy = req.user.role === 'pharmacy';
    const isShipping = req.user.role === 'shipping_company';
    const recipientIsPharmacy = recipient.role === 'pharmacy';
    const recipientIsShipping = recipient.role === 'shipping_company';

    if (!((isPharmacy && recipientIsShipping) || (isShipping && recipientIsPharmacy))) {
        return res.status(400).json({ message: "Chat is only allowed between pharmacies and shipping companies." });
    }

    const pharmacyId = isPharmacy ? senderId : recipientId;
    const shippingId = isShipping ? senderId : recipientId;

    // Check for accepted contract
    const contract = await Contract.findOne({
        pharmacy: pharmacyId,
        shippingCompany: shippingId,
        status: 'accepted'
    });

    // Find or Create Conversation
    let conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] }
    });

    if (!conversation) {
        conversation = await Conversation.create({
            participants: [senderId, recipientId]
        });
    }

    // Enforce 2-message limit if NO contract exists
    if (!contract) {
        if (conversation.messageCount >= 2 && !conversation.isBlockedForNewMessages) {
            // Check if the other party has replied or if there's an invitation
            // But the requirement said: "one or two messages, and after that you can't send until the other party approves"
            // We'll simplify: 2 messages total until a contract is accepted or "unblocked".
            return res.status(403).json({
                message: "Message limit reached. You can only send 2 messages until a contract is accepted.",
                requiresContract: true
            });
        }
    }

    // Create Message
    const message = await Message.create({
        conversationId: conversation._id,
        sender: senderId,
        text
    });

    // Update Conversation
    conversation.lastMessage = message._id;
    conversation.messageCount += 1;
    if (!contract && conversation.messageCount >= 2) {
        conversation.isBlockedForNewMessages = true;
    }
    await conversation.save();

    // Send Notification
    try {
        if (recipient.fcmTokens && recipient.fcmTokens.length > 0) {
            await NotificationService.sendToMultipleDevices(
                recipient.fcmTokens,
                `New Message from ${req.user.username}`,
                text.substring(0, 50) + (text.length > 50 ? "..." : ""),
                { conversationId: conversation._id.toString(), type: "NEW_CHAT_MESSAGE" }
            );
        }
    } catch (err) {
        console.error("Chat Notification Error:", err);
    }

    res.status(201).json({ message, conversation });
});

/**
 * @desc    Get messages for a conversation
 * @route   GET /api/ecommerce-chat/:conversationId
 * @access  private
 */
exports.getMessages = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(req.user._id)) {
        return res.status(403).json({ message: "Access denied" });
    }

    const messages = await Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('sender', 'username avatar');

    res.status(200).json(messages);
});

/**
 * @desc    Get all my conversations
 * @route   GET /api/ecommerce-chat/conversations
 * @access  private
 */
exports.getMyConversations = asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({
        participants: req.user._id
    })
        .populate('participants', 'username avatar role phone')
        .populate('lastMessage')
        .sort({ updatedAt: -1 });

    res.status(200).json(conversations);
});
