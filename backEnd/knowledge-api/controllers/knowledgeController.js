const KnowledgeArticle = require('../models/Knowledge/knowledgeArticle');
const asyncHandler = require('express-async-handler');
const axios = require('axios');

/**
 * @desc    Search knowledge base (Local and External)
 * @route   GET /api/knowledge/search
 * @access  public
 */
exports.searchKnowledge = asyncHandler(async (req, res) => {
    const { query, lang = 'ar' } = req.query;

    if (!query) {
        return res.status(400).json({ message: "Please provide a search query" });
    }

    // 1. Search Local Database
    let results = await KnowledgeArticle.find({
        $text: { $search: query }
    }).limit(5);

    // 2. If no local results, or to enrich results, fetch from Wikipedia
    if (results.length === 0) {
        try {
            // Wikipedia API for summaries
            const wikiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const wikiResponse = await axios.get(wikiUrl);

            if (wikiResponse.data && wikiResponse.data.extract) {
                const wikiArticle = {
                    title: wikiResponse.data.title,
                    content: wikiResponse.data.extract,
                    source: 'wikipedia',
                    externalLink: wikiResponse.data.content_urls.desktop.page,
                    category: 'other',
                    language: lang
                };
                results.push(wikiArticle);
            }
        } catch (wikiErr) {
            console.error("Wikipedia Search Error:", wikiErr.message);
        }
    }

    // 3. If searching for a drug, try OpenFDA (English only)
    if (results.length === 0 || query.toLowerCase().includes('drug') || query.toLowerCase().includes('دواء')) {
        try {
            const fdaUrl = `https://api.fda.gov/drug/label.json?search=generic_name:${encodeURIComponent(query)}+brand_name:${encodeURIComponent(query)}&limit=1`;
            const fdaResponse = await axios.get(fdaUrl);

            if (fdaResponse.data && fdaResponse.data.results && fdaResponse.data.results.length > 0) {
                const drug = fdaResponse.data.results[0];
                const fdaArticle = {
                    title: drug.openfda.brand_name ? drug.openfda.brand_name[0] : query,
                    content: drug.indications_and_usage ? drug.indications_and_usage[0] : "Medical information found on OpenFDA.",
                    source: 'openFDA',
                    category: 'drug',
                    language: 'en',
                    tags: drug.openfda.pharmaceutical_class_epc || []
                };
                results.push(fdaArticle);
            }
        } catch (fdaErr) {
            console.error("OpenFDA Search Error:", fdaErr.message);
        }
    }

    res.status(200).json({
        query,
        count: results.length,
        results
    });
});

/**
 * @desc    Add a local knowledge article
 * @route   POST /api/knowledge
 * @access  private (Admin or Professional)
 */
exports.addKnowledgeArticle = asyncHandler(async (req, res) => {
    const { title, content, category, tags, language } = req.body;

    if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required." });
    }

    const article = await KnowledgeArticle.create({
        title,
        content,
        category,
        tags,
        language,
        author: req.user._id,
        source: 'local'
    });

    res.status(201).json(article);
});
