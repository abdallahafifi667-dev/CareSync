var express = require('express');
var router = express.Router();
const postsController = require("../controllers/postsController");
const { verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin, } = require('../../middlewares/verifytoken');
const upload = require('../middlewares/upload');
const validateObjectId = require('../middlewares/validateObjectId');
//create a new post

router.post('/:id', verifyTokenAndAuthorization, upload.single('image'), postsController.createPost);

//get all posts

router.get('/', verifyToken,  postsController.getAllPosts);
//get post by id (user)
router.get('/:id', verifyToken, postsController.getAllPostsUser);
//get one post by id
router.get('/post/:id', verifyToken, postsController.getPost);
 //delete post
router.delete("/:id", verifyToken , postsController.deletePost);
router.put("/:id",verifyToken, postsController.updatePost);
router.put("/updatePhoto/:id", verifyToken, upload.single('image'), postsController.updatePhotoPost);
 //like post
router.put("/:id/like",validateObjectId,  verifyToken, postsController.likePost);
//unlike post
router.put("/:id/unlike",validateObjectId,  verifyToken, postsController.unlikePost);






module.exports = router