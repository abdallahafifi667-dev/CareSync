const mongoose = require('mongoose');
const { getKnowledgeDB } = require("../../config/conectet");

const knowledgeArticleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    content: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['disease', 'drug', 'treatment', 'symptom', 'other'],
        default: 'other'
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    source: { // 'local', 'wikipedia', 'openFDA'
        type: String,
        default: 'local'
    },
    externalLink: String,
    language: {
        type: String,
        default: 'ar'
    },
    tags: [String]
}, { timestamps: true });

// Fuzzy search index for title
knowledgeArticleSchema.index({ title: 'text', content: 'text' });

module.exports = getKnowledgeDB().model('KnowledgeArticle', knowledgeArticleSchema);
