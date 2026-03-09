const { getPlogDB } = require("../../config/conectet");
const mongoose = require('mongoose');
const joi = require('joi');

//category schema
const categorySchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    type: { // ✅ للتفريق بين تصنيفات المدونة والمتجر المحترف
        type: String,
        enum: ["blog", "ecommerce"],
        default: "blog"
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
}, { timestamps: true });

// دالة التحقق باستخدام Joi
const vildateCategory = (data) => {
    const schema = joi.object({
        text: joi.string().min(1).required().trim().label("Category Name"),
        type: joi.string().valid("blog", "ecommerce").default("blog")
    });
    return schema.validate(data);
}

const category = getPlogDB().model('category', categorySchema);
module.exports = { category, vildateCategory };
