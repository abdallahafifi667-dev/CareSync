const { Post, vildateCreatePost, vildateUpdatePost, } = require('../../models/plog/post');
const asyncHandler = require('express-async-handler');
const cloudinary = require('../../config/cloudinary');
const xss = require("xss")
const comment = require("../../models/plog/comment");


/**
 * @desc create new post
 * @route api/posts
 * @method post
 * @access private
 * */

exports.createPost = asyncHandler(async(req, res) => {
    try {

        const data = {
            title: xss(req.body.title),
            description: xss(req.body.description),
            category: xss(req.body.category)
        }

        const { error } = vildateCreatePost(data);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { title, description, category } = data;
        let imageUrl = null;

        // ✅ التحقق إذا كان هناك صورة مرفوعة
        if (req.file) {
            try {
                const uploadPromise = new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream({ folder: 'posts' },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result.secure_url);
                        }
                    );
                    stream.end(req.file.buffer); // مباشرة بدون حفظها في السيرفر
                });

                imageUrl = await uploadPromise;
            } catch (error) {
                console.log("Cloudinary Upload Error:", error);
                return res.status(500).json({ error: "Image upload failed, please try again." });
            }
        }

        // ✅ إنشاء المنشور في قاعدة البيانات
        const newPost = new Post({
            title,
            description,
            category,
            user: req.user.id,
            image: imageUrl
        });

        const post = await newPost.save();
        res.status(201).json({ message: "Post created successfully", post });
    } catch (error) {
        console.log("Error creating post:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
/**
 * @desc get all posts
 * @route api/posts/add
 * @method get
 * @access public
 * */

exports.getAllPosts = asyncHandler(async(req, res) => {
    try {
        let { namPage, category } = req.query;
        let limit = 2;

        namPage = Number(namPage) || 1;
        if (namPage < 1) namPage = 1;

        const query = category ? { category } : {};

        // حساب إجمالي عدد البوستات المطابقة للبحث
        const totalPosts = await Post.countDocuments(query);
        const totalPages = Math.ceil(totalPosts / limit);

        const posts = await Post.find(query)
            .skip((namPage - 1) * limit)
            .limit(limit)
            .sort('-createdAt')
            .populate("user", ["-password"]);

        if (!posts.length) {
            return res.status(404).json({ error: "Posts not found" });
        }

        res.status(200).json({
            posts,
            currentPage: namPage,
            totalPages,
            totalPosts
        });
    } catch (error) {
        console.error("Error getting posts:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



/**
 * @desc get all posts(user)
 * @route api/posts/:id
 * @method get
 * @access private
 * */

exports.getAllPostsUser = asyncHandler(async(req, res) => {
    try {
        //req query params


        const posts = await Post.find({ user: req.params.id }).populate("user", "-password -email").sort('-createdAt');
        if (!posts) return res.status(404).json({ error: "Post not found" });
        // console.log(posts);
        res.status(201).json(posts);
    } catch (error) {
        console.error("Error getting posts:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
})

/**
 * @desc get one post
 * @route api/post/:id
 * @method get
 * @access public or private
 * */

exports.getPost = asyncHandler(async(req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate("user", ["-password"])
            .populate("comments");
        if (!post) return res.status(404).json({ error: "Post not found" });
        res.status(201).json(post);
    } catch (error) {
        console.error("Error getting post:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
/**
 * @desc delete one post(user)
 * @route api/posts/:id
 * @method delete
 * @access private
 * */

exports.deletePost = asyncHandler(async(req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Post not found" });
        // حذف الصورة من Cloudinary
        if (post.image) {
            // استخراج `public_id` من رابط الصورة
            const publicId = post.image.match(/\/([^\/]+?)(\.[^\/.]*)?$/)[1]
            await cloudinary.uploader.destroy(`posts/${publicId}`);
        }
        // حذف المنشور من قاعدة البيانات
        if (req.user.isAdmin || req.user.id === post.user.toString()) {
            await Post.findByIdAndDelete(req.params.id);
            await comment.deleteMany({ post: req.params.id }); // حذف التعليقات المرتبطة به المنشور
        }
        res.json({ message: "Post and all associated data deleted successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @desc update one post(user)
 * @route api/posts/:id
 * @method put
 * @access private
 * */

exports.updatePost = asyncHandler(async(req, res) => {
        const data = {
            title: xss(req.body.title),
            description: xss(req.body.description),
            category: xss(req.body.category)

        }
        const { error } = vildateUpdatePost(data);
        if (error) return res.status(400).json({ error: error.details[0].message });
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: "post not found" });
        }

        // 3. check if this post belong to logged in user
        if (req.user.id !== post.user.toString()) {
            return res
                .status(403)
                .json({ message: "access denied, you are not allowed" });
        }

        // 4. Update post
        const updatedPost = await Post.findByIdAndUpdate(
            req.params.id, { $set: { title: data.title, description: data.description, category: data.category } }, { new: true }
        );
        res.json(post);

    })
    /**
     * @desc update photo post(user)
     * @route api/posts/updete/:id
     * @method put
     * @access private
     * */
exports.updatePhotoPost = asyncHandler(async(req, res) => {
    // التحقق من وجود ملف الصورة
    if (!req.file)
        return res.status(400).json({ message: "No image provided" });

    // الحصول على المنشور والتحقق من وجوده وصلاحية المستخدم
    const post = await Post.findById(req.params.id);
    if (!post)
        return res.status(404).json({ error: "Post not found" });
    if (req.user.id !== post.user.toString())
        return res.status(403).json({ message: "Access denied, you are not allowed" });

    // حذف الصورة القديمة إذا كانت موجودة
    if (post.image) {
        const publicId =
            post.image.publicId ||
            ((post.image.url.match(/\/([^\/]+?)(\.[^\/.]*)?$/) || [])[1] && `posts/${post.image.url.match(/\/([^\/]+?)(\.[^\/.]*)?$/)[1]}`);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId);
        }
    }

    // رفع الصورة الجديدة باستخدام stream من buffer
    const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'posts' },
            (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
    });

    // تحديث الصورة في المنشور وحفظه
    post.image = { url: result.secure_url, publicId: result.public_id };
    const updatedPost = await post.save();
    res.status(200).json(updatedPost);
});


/**
 * @desc like post
 * @route api/posts/:id/like
 * @method put
 * @access private
 * */

exports.likePost = asyncHandler(async(req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $addToSet: { like: req.user.id } }, { new: true })
            .populate("user", ["-password"]);
        if (!post) return res.status(404).json({ error: "Post not found" });
        res.json(post);
        console.log(post)
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
})

/**
 * @desc unlike post
 * @route api/posts/:id/unlike
 * @method put
 * @access private
 * */

exports.unlikePost = asyncHandler(async(req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $pull: { like: req.user.id } }, { new: true })
            .populate("user", ["-password"]);
        if (!post) return res.status(404).json({ error: "Post not found" });
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
})

/**
 * الطريقه الافضل
 * or
 *

*/

// exports.likePost = asyncHandler(async (req, res) => {
//     const post = await Post.findById(req.params.id);
//     if (!post) return res.status(404).json({ error: "Post not found" });

//     // التحقق مما إذا كان المستخدم قد قام بالإعجاب من قبل
//     if (post.like.includes(req.user.id)) {
//         // إذا كان قد قام بالإعجاب، قم بإزالة الإعجاب (Dislike)
//         post.like = post.like.filter((id) => id !== req.user.id);
//     } else {
//         // إذا لم يقم بالإعجاب، قم بإضافته
//         post.like.push(req.user.id);
//     }

//     const updatedPost = await post.save();
//     res.status(200).json(updatedPost);
// });
/**
 * or exports.likeMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "الرسالة غير موجودة" });
    }
    const userId = req.user._id;
    const index = message.like.indexOf(userId);
    if (index === -1) {
      message.like.push(userId);
    } else {
      message.like.splice(index, 1);
    }
    await message.save();
    res.status(200).json({ message: "تم تحديث الإعجاب" });
}
); 
ولكن الطريقه الاوله لي المشريع الكبيره 
والثانيه لي المشاريع المتوسط والتعليقات 
الثالثه نفس الامر ولكن يمكن تصنيفها انها اصغبر
 */

/**
 * @desc get all posts
 * @route api/posts/allposts
 * @method get
 * @access public (admin only)
 * */

exports.getAllPostsAdmin = asyncHandler(async(req, res) => {
    try {
        const posts = await Post.find().populate("user", ["-password"]);
        if (!posts) return res.status(404).json({ error: "Posts not found" });
        res.status(201).json(posts);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
})