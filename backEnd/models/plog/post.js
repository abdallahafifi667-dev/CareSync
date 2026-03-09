const { getPlogDB } = require("../../config/conectet");
const mongoose = require('mongoose');
const Joi = require('joi');
const postUser = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
    },
    image: {
        type: String,
        default: "https://cdn.pixabay.com/photo/2021/07/02/04/48/user-6380868_1280.png"
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    category: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100,
    },
    like: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
}, );
postUser.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'post'
})

//viled create post 
function vildateCreatePost(ojb) {
    const schema = Joi.object({
        title: Joi.string().min(1).max(200).required().trim(),
        description: Joi.string().min(1).required().trim(),
        category: Joi.string().required().trim(),
    });
    return schema.validate(ojb);

} //viled update post 
function vildateUpdatePost(ojb) {
    const schema = Joi.object({
        title: Joi.string().min(1).max(200).trim(),
        description: Joi.string().min(1).trim(),
        category: Joi.string().trim(),
    });
    return schema.validate(ojb);
}
const Post = getPlogDB().model('Post', postUser);
module.exports = {
    Post,
    vildateCreatePost,
    vildateUpdatePost,

}