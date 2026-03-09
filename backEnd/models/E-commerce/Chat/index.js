const mongoose = require('mongoose');
const { getChatDB } = require("../../../config/conectet");

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    messageCount: {
        type: Number,
        default: 0
    },
    isBlockedForNewMessages: { // True if no contract and 2 messages reached
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Conversation = getChatDB().model('Conversation', conversationSchema);
const Message = getChatDB().model('Message', messageSchema);

module.exports = { Conversation, Message };
