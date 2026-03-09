const Product = require('../../models/E-commerce/products');
const Review = require("../../models/E-commerce/Review");

const asyncHandler = require('express-async-handler');


/**
 * @desc   (search) get all products
 * @route   GET /api/products
 * @access  عام
 */

exports.getAllProducts = asyncHandler(async (req, res) => {
  const { search, price, category, lat, lng, page = 1, limit = 10 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const pageSize = parseInt(limit);

  // 1. Base Query: Must be in the Same Country and have stock
  const query = {
    stockQuantity: { $gt: 0 }
  };

  // Restrict to User's Country (Security and Requirement)
  if (req.user && req.user.country) {
    // We need to join with User to check their country if products don't have it directly.
    // However, the requirement is "don't leave the country borders".
    // I will use an aggregation to filter by the author's country.
  }

  // Fuzzy Search (Regex based)
  if (search) {
    const searchRegex = new RegExp(search.split(' ').map(s => `(?=.*${xss(s)})`).join(''), 'i');
    query.$or = [
      { name: { $regex: searchRegex } },
      { description: { $regex: searchRegex } }
    ];
  }

  if (category) {
    query.category = category;
  }

  if (price) {
    const maxPrice = parseFloat(price);
    if (!isNaN(maxPrice)) {
      query.price = { $gte: 0, $lte: maxPrice };
    }
  }

  // 2. Aggregation Pipeline for Proximity + Country Filter + Pagination
  const pipeline = [
    { $match: query },
    {
      $lookup: {
        from: "users", // Collection name for User model
        localField: "author",
        foreignField: "_id",
        as: "authorDetails"
      }
    },
    { $unwind: "$authorDetails" },
    // STRICT COUNTRY FILTER
    { $match: { "authorDetails.country": req.user.country } }
  ];

  // Proximity Calculation if lat/lng provided
  if (lat && lng) {
    const userLng = parseFloat(lng);
    const userLat = parseFloat(lat);

    pipeline.push({
      $addFields: {
        distance: {
          $sqrt: {
            $add: [
              { $pow: [{ $subtract: [{ $arrayElemAt: ["$authorDetails.location.coordinates", 0] }, userLng] }, 2] },
              { $pow: [{ $subtract: [{ $arrayElemAt: ["$authorDetails.location.coordinates", 1] }, userLat] }, 2] }
            ]
          }
        }
      }
    });
    pipeline.push({ $sort: { distance: 1, createdAt: -1 } });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  // Handle Pagination in Aggregation
  const countPipeline = [...pipeline, { $count: "total" }];
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: pageSize });

  const [products, totalCount] = await Promise.all([
    Product.aggregate(pipeline),
    Product.aggregate(countPipeline)
  ]);

  const total = totalCount.length > 0 ? totalCount[0].total : 0;

  res.status(200).json({
    products,
    pagination: {
      total,
      page: parseInt(page),
      limit: pageSize,
      pages: Math.ceil(total / pageSize)
    }
  });
});




/**
 * @desc    get one product by id
 * @route   GET /api/products/:id
 * @access  عام
 */

exports.getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.status(200).json(product);
});

/**
 * @desc   get all reviews for a product by id
 * @route   GET /api/products/:id/reviews
 * @access  عام
 */
exports.getReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ product: req.params.id })
    .populate('user', 'name email');
  if (!reviews.length) {
    return res.status(404).json({ message: 'No reviews found for this product' });
  }
  res.status(200).json(reviews);
});