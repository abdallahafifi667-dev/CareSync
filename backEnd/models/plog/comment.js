const { getPlogDB } = require("../../config/conectet");
const mongoose = require('mongoose');
const joi = require('joi');

const commentSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    parentComment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    like: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
}, { timestamps: true });

const vildateComment = (data) => {
    const schema = joi.object({
        text: joi.string().min(1).required().trim(),
        parentComment: joi.string().optional().allow(null, '')
    });
    return schema.validate(data);
};

const Comment = getPlogDB().model('Comment', commentSchema);
module.exports = { Comment, vildateComment };
