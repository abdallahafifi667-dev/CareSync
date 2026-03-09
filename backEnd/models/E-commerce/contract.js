const mongoose = require('mongoose');
const { getEcomDB } = require("../../config/conectet");

const contractSchema = new mongoose.Schema({
    pharmacy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    shippingCompany: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'inactive'],
        default: 'pending'
    },
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: { // Optional message/form data
        type: String,
        trim: true
    },
    businessDetails: { // To store the "form" mentioned in audio
        address: String,
        description: String,
        phone: String,
        workingHours: String
    }
}, { timestamps: true });

// Prevent duplicate active/pending connections between same pharmacy and company
contractSchema.index({ pharmacy: 1, shippingCompany: 1 }, { unique: true });

module.exports = getEcomDB().model('Contract', contractSchema);
