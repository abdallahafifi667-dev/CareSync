const mongoose = require('mongoose');
const { getEcomDB } = require("../../config/conectet");

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },

    comment: {
        type: String
    },
  }, { timestamps: true });
  
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // يمنع التكرار
  module.exports = getEcomDB().model('Review', reviewSchema);
  