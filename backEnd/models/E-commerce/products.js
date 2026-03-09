const mongoose = require('mongoose');
const { getEcomDB } = require("../../config/conectet");

const { Schema } = mongoose;
const productSchema = new Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  stockQuantity: {
    type: Number,
    required: true,
  },
  ReservedQuantity: {
    type: Number,
    default: 0,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },

  imageUrl: [{
    type: String,
    required: true,
  }],
  Address: {
    type: String,
    required: true,
  },
  avgRating: {
    type: Number, default: 0
  },
  totalRatings: {
    type: Number, default: 0
  }
},

  {
    timestamps: true,
  });
module.exports = getEcomDB().model('Product', productSchema);