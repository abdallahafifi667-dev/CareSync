const express = require('express');
const router = express.Router();
const { searchKnowledge, addKnowledgeArticle } = require('../controllers/knowledgeController');
const { verifyTokenAndAdmin } = require('../../middlewares/verifytoken');

router.get('/search', searchKnowledge);
router.post('/', verifyTokenAndAdmin, addKnowledgeArticle);

module.exports = router;
