const { category, vildateCategory } = require('../../models/plog/category');
const asyncHandler = require('express-async-handler');
const xss = require("xss");

/**
 * @desc create new category
 * @route /api/categories
 * @method Post
 * @access public
 */

exports.createCategory = asyncHandler(async (req, res) => {
    try {
        const data = {
            text: xss(req.body.text),
            type: req.body.type || "blog" 
        }
        const { error } = vildateCategory(data);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const newCategory = new category({
            text: data.text,
            type: data.type,
            user: req.user.id
        });
        await newCategory.save();

        res.status(201).json({ message: "Category created successfully", data: newCategory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * @desc get all categories
 * @route /api/categories/all
 * @method get
 * @access public
 */

exports.getCategories = asyncHandler(async (req, res) => {
    try {
        const { type } = req.query;
        const filter = type ? { type } : {};
        const categories = await category.find(filter);
        res.status(200).json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * @desc update category
 * @route /api/categories/:id
 * @method Put
 * @access admin
 */
exports.updateCategory = asyncHandler(async (req, res) => {
    try {
        const { text, type } = req.body;
        const validationData = { text: xss(text) };
        if (type) validationData.type = type;

        const { error } = vildateCategory(validationData);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const updateData = { text: xss(text) };
        if (type) updateData.type = type;

        const updatedCategory = await category.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

        res.status(200).json({ message: "Category updated successfully", data: updatedCategory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * @desc delete category
 * @route /api/categories/:id
 * @method Delete
 * @access admin
 */
exports.deleteCategory = asyncHandler(async (req, res) => {
    try {
        const deletedCategory = await category.findByIdAndDelete(req.params.id);

        if (!deletedCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

        res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});
