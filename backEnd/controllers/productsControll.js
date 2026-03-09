const Product = require('../../models/E-commerce/products');
const { category: Category } = require('../../models/plog/category');
const asyncHandler = require('express-async-handler');
const xss = require('xss');
const Joi = require('joi');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');

// Middleware to check pharmacy/merchant role
const merchant = (req, res, next) => {
  if (req.user.role !== 'pharmacy') {
    return res.status(403).json({ message: 'Access denied. Only pharmacies can add products.' });
  }
  next();
};

// Validation schemas
const addProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().required(),
  category: Joi.string().required(),
  stockQuantity: Joi.number().required(),
  Address: Joi.string().required(),
});

const updateProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().required(),
  category: Joi.string().required(),
  stockQuantity: Joi.number().required(),
});

// Add Product
exports.addProduct = [
  merchant,
  asyncHandler(async (req, res) => {
    // Sanitize and parse input
    const data = {
      name: xss(req.body.name),
      description: xss(req.body.description),
      Address: xss(req.body.Address),
      price: parseFloat(req.body.price),
      category: req.body.category,
      stockQuantity: parseInt(req.body.stockQuantity),
    };

    // Validate
    const { error } = addProductSchema.validate(data);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Validate Category ID
    if (!mongoose.Types.ObjectId.isValid(data.category)) {
      return res.status(400).json({ message: 'Category ID غير صالح' });
    }
    const category = await Category.findById(data.category);
    if (!category) {
      return res.status(400).json({ message: 'Category not found' });
    }

    // Check files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'يجب رفع ملف واحد على الأقل' });
    }

    // Upload to Cloudinary
    const cloudinaryFolder = `users/${req.user._id}/products`;
    const uploadPromises = req.files.map(file =>
      new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: cloudinaryFolder, resource_type: 'auto' },
          (error, result) => {
            if (error) return reject(new Error(`فشل رفع الملف: ${file.originalname}`));
            resolve(result.secure_url);
          }
        ).end(file.buffer);
      })
    );

    const uploadedUrls = await Promise.all(uploadPromises);

    // Create
    const product = await Product.create({
      name: data.name,
      description: data.description,
      price: data.price,
      category: data.category,
      stockQuantity: data.stockQuantity,
      imageUrl: uploadedUrls,
      author: req.user._id,
      Address: data.Address,
    });

    res.status(201).json({ message: 'تم إضافة المنتج بنجاح', product });
  }),
];

// Update Product
exports.updateProduct = [
  merchant,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check valid ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Product ID غير صالح' });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Authorization
    if (product.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not the author of this product' });
    }

    // Sanitize and parse
    const data = {
      name: xss(req.body.name),
      description: xss(req.body.description),
      price: parseFloat(req.body.price),
      category: req.body.category,
      stockQuantity: parseInt(req.body.stockQuantity, 10),
    };

    // Validate
    const { error } = updateProductSchema.validate(data);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Validate Category
    if (!mongoose.Types.ObjectId.isValid(data.category)) {
      return res.status(400).json({ message: 'Category ID غير صالح' });
    }
    const category = await Category.findById(data.category);
    if (!category) {
      return res.status(400).json({ message: 'Category not found' });
    }

    // Update fields
    product.name = data.name;
    product.description = data.description;
    product.price = data.price;
    product.category = data.category;
    product.stockQuantity = data.stockQuantity;

    // Optionally handle new images upload if needed here

    await product.save();

    res.status(200).json({ message: 'Product updated successfully', product });
  }),
];

// Delete Product
exports.deleteProduct = [
  merchant,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Product ID غير صالح' });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not the author of this product' });
    }

    // Delete from Cloudinary
    const publicIds = product.imageUrl.map(url => {
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      return filename.split('.')[0];
    });
    await Promise.all(
      publicIds.map(pid => new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(pid, (error, result) => {
          if (error) return reject(new Error(`فشل حذف الصورة: ${pid}`));
          resolve(result);
        });
      }))
    );

    await product.remove();
    res.status(200).json({ message: 'Product deleted successfully' });
  }),
];

// Get Merchant's Products
exports.getAllProductsMerchant = [
  merchant,
  asyncHandler(async (req, res) => {
    const products = await Product.find({ author: req.user._id });
    res.status(200).json(products);
  }),
];
