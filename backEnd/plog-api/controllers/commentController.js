const { Comment, vildateComment } = require('../../models/plog/comment');
const asyncHandler = require('express-async-handler');
const xss = require("xss");

/**
 * @desc إنشاء تعليق جديد (ممكن يكون تعليق رئيسي أو رد على تعليق آخر)
 * @route POST api/comment/:postId/comments
 */
exports.createComment = asyncHandler(async (req, res) => {
    try {
        const data = {
            text: xss(req.body.text),
            parentComment: req.body.parentComment ? xss(req.body.parentComment) : null
        };

        const { error } = vildateComment(data);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const comment = new Comment({
            text: data.text,
            user: req.user.id,
            post: req.params.id,
            parentComment: data.parentComment
        });
        await comment.save();
        // Populate بيانات المستخدم لكي تظهر التفاصيل مثل username وavatar
        await comment.populate('user', '-password');
        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


/**
 * @desc جلب جميع التعليقات المرتبطة بمنشور معين بشكل هرمي (nested)
 * @route GET api/comment/:postId/comments
 */
exports.getAllCommentsForPost = asyncHandler(async (req, res) => {
    try {
        // جلب كل التعليقات الخاصة بالمنشور باستخدام req.params.id وترتيبها حسب تاريخ الإنشاء
        const allComments = await Comment.find({ post: req.params.id })
            .populate('user', ['-password'])
            .sort('createdAt')
            .lean(); // تحويل المستندات إلى كائنات عادية للتعديل عليها

        // بناء شجرة التعليقات
        const commentMap = new Map();
        allComments.forEach(comment => {
            comment.replies = []; // إضافة مصفوفة للردود داخل كل تعليق
            commentMap.set(comment._id.toString(), comment);
        });

        const nestedComments = [];
        allComments.forEach(comment => {
            if (comment.parentComment) {
                // لو التعليق عبارة عن رد، نضيفه للمصفوفة replies للتعليق الأب
                const parent = commentMap.get(comment.parentComment.toString());
                if (parent) {
                    parent.replies.push(comment);
                } else {
                    // لو لم يجد الأب، نضيفه كتعليق رئيسي
                    nestedComments.push(comment);
                }
            } else {
                // تعليق رئيسي
                nestedComments.push(comment);
            }
        });
        res.status(200).json(nestedComments);
        console.log(nestedComments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


/**
 * @desc حذف تعليق معين
 * @route DELETE api/comments/:commentId
 */
exports.deleteComment = asyncHandler(async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        // السماح بالحذف فقط للمسؤول أو صاحب التعليق
        if (req.user.isAdmin || req.user.id === comment.user.toString()) {
            await comment.remove();
            res.json({ message: "Comment deleted successfully!" });
        } else {
            res.status(403).json({ error: "Unauthorized" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @desc تعديل تعليق معين
 * @route PUT api/comments/:commentId
 */
exports.updateComment = asyncHandler(async (req, res) => {
    try {
        const data = {
            text: xss(req.body.text)
        };

        // التحقق من صحة البيانات
        const { error } = vildateComment(data);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        // السماح بالتعديل فقط للمسؤول أو صاحب التعليق
        if (req.user.isAdmin || req.user.id === comment.user.toString()) {
            comment.text = data.text;
            await comment.save();
        } else {
            return res.status(403).json({ error: "Unauthorized" });
        }

        res.json(comment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @desc togle like comment
 * @route api/comment/:id/like
 * @method put
 * @access private
 * */

exports.likeComment = asyncHandler(async (req, res) => {
    try {
        const comment = await Comment.findByIdAndUpdate(req.params.id, { $addToSet: { like: req.user.id } }, { new: true });
        if (!comment) return res.status(404).json({ error: "Comment not found" });
        res.json(comment);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @desc togle unlike comment
 * @route api/comment/:id/unlike
 * @method put
 * @access private
 * */

exports.unlikeComment = asyncHandler(async (req, res) => {
    try {
        const comment = await Comment.findByIdAndUpdate(req.params.id, { $pull: { like: req.user.id } }, { new: true });
        if (!comment) return res.status(404).json({ error: "Comment not found" });
        res.json(comment);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @desc get all comments
 * @route api/comments
 * @method get
 * @access public (admin only)
 * */

exports.getAllComments = asyncHandler(async (req, res) => {
    try {
        const comments = await Comment.find().populate("user", ["-password"]);
        if (!comments) return res.status(404).json({ error: "Comments not found" });
        res.status(201).json(comments);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
})