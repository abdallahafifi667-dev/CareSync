const asyncHandler = require("express-async-handler");
const xss = require("xss");
const { getUserModel } = require("../../models/users-core/users.models");
const { parseGCSMetadata } = require("../../middlewares/gcsWebhookAuth");
const { deleteFile } = require("../../config/googleCloudStorage");

const User = getUserModel();

/**
 * @desc    Add a new academic degree to user's profile
 * @route   POST /api/user/academic-degrees
 * @access  Private
 */
exports.addAcademicDegree = asyncHandler(async (req, res) => {
    try {
        const { degree, field, institution, graduationYear } = req.body;
        const userId = req.user._id;

        // Validate required fields
        if (!degree || !field || !institution) {
            return res.status(400).json({
                message: "Degree type, field of study, and institution are required",
            });
        }

        // Validate degree type
        const validDegrees = ["bachelor", "master", "phd", "diploma", "associate", "other"];
        if (!validDegrees.includes(degree)) {
            return res.status(400).json({
                message: `Invalid degree type. Must be one of: ${validDegrees.join(", ")}`,
            });
        }

        // Check if user exists and email is verified
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.email.verified) {
            return res.status(403).json({
                message: "Email must be verified before adding academic degrees",
            });
        }

        // Add new academic degree
        const newDegree = {
            degree: degree,
            field: xss(field),
            institution: xss(institution),
            graduationYear: graduationYear ? Number(graduationYear) : null,
            certificateImage: null, // Will be updated when webhook returns image URL
        };

        user.academicDegrees.push(newDegree);
        await user.save();

        console.log(`addAcademicDegree successfully ${userId}`);
        res.status(201).json({
            message: "Academic degree added successfully",
            academicDegree: newDegree,
            academicDegrees: user.academicDegrees,
        });
    } catch (error) {
        console.error(`addAcademicDegree error:`, error);
        res.status(500).json({
            message: "Error adding academic degree",
            error: error.message,
        });
    }
});

/**
 * @desc    Get all academic degrees for user
 * @route   GET /api/user/academic-degrees
 * @access  Private
 */
exports.getAcademicDegrees = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId).select("academicDegrees");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        console.log(`getAcademicDegrees successfully ${userId}`);
        res.status(200).json({
            academicDegrees: user.academicDegrees,
            count: user.academicDegrees.length,
        });
    } catch (error) {
        console.error(`getAcademicDegrees error:`, error);
        res.status(500).json({
            message: "Error fetching academic degrees",
            error: error.message,
        });
    }
});

/**
 * @desc    Update an academic degree by ID
 * @route   PUT /api/user/academic-degrees/:degreeId
 * @access  Private
 */
exports.updateAcademicDegree = asyncHandler(async (req, res) => {
    try {
        const { degreeId } = req.params;
        const { degree, field, institution, graduationYear } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Find academic degree by ID
        const academicDegree = user.academicDegrees.id(degreeId);

        if (!academicDegree) {
            return res.status(404).json({
                message: "Academic degree not found in your profile",
            });
        }

        // Update degree type if provided
        if (degree) {
            const validDegrees = ["bachelor", "master", "phd", "diploma", "associate", "other"];
            if (!validDegrees.includes(degree)) {
                return res.status(400).json({
                    message: `Invalid degree type. Must be one of: ${validDegrees.join(", ")}`,
                });
            }
            academicDegree.degree = degree;
        }

        if (field) academicDegree.field = xss(field);
        if (institution) academicDegree.institution = xss(institution);
        if (graduationYear !== undefined) academicDegree.graduationYear = Number(graduationYear);

        await user.save();

        console.log(`updateAcademicDegree successfully ${userId}`);
        res.status(200).json({
            message: "Academic degree updated successfully",
            academicDegree: academicDegree,
            academicDegrees: user.academicDegrees,
        });
    } catch (error) {
        console.error(`updateAcademicDegree error:`, error);
        res.status(500).json({
            message: "Error updating academic degree",
            error: error.message,
        });
    }
});

/**
 * @desc    Delete an academic degree by ID
 * @route   DELETE /api/user/academic-degrees/:degreeId
 * @access  Private
 */
exports.deleteAcademicDegree = asyncHandler(async (req, res) => {
    try {
        const { degreeId } = req.params;
        const userId = req.user._id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const degreeToDelete = user.academicDegrees.id(degreeId);

        if (!degreeToDelete) {
            return res.status(404).json({
                message: "Academic degree not found in your profile",
            });
        }

        // Delete certificate image from GCS if exists
        if (degreeToDelete.certificateImage) {
            try {
                // Extract filename from URL
                const urlParts = degreeToDelete.certificateImage.split("/");
                const fileName = urlParts.slice(4).join("/"); // skip https://storage.googleapis.com/bucket/
                await deleteFile(fileName);
            } catch (e) {
                console.error("Failed to delete certificate image from GCS:", e);
            }
        }

        degreeToDelete.deleteOne();
        await user.save();

        console.log(`deleteAcademicDegree successfully ${userId}`);
        res.status(200).json({
            message: "Academic degree deleted successfully",
            academicDegrees: user.academicDegrees,
        });
    } catch (error) {
        console.error(`deleteAcademicDegree error:`, error);
        res.status(500).json({
            message: "Error deleting academic degree",
            error: error.message,
        });
    }
});

/**
 * @desc    Handle certificate image upload webhook from GCS
 * @route   POST /api/user/academic-degrees/webhook/image
 * @access  Public (with signature verification)
 */
exports.handleCertificateImageWebhook = asyncHandler(async (req, res) => {
    try {
        // GCS Object Change Notification structure
        const notification = req.body;
        const fileName = notification.name;
        const eventType = notification.eventType || notification.kind;

        // Only process finalize events
        if (eventType !== "OBJECT_FINALIZE" && eventType !== "storage#object") {
            return res.status(200).json({ status: "ignored" });
        }

        const metadata = parseGCSMetadata(notification);
        const userId = metadata.userId;
        const degreeId = metadata.degreeId;

        if (!userId || !degreeId) {
            // Cleanup invalid upload
            try {
                await deleteFile(fileName);
            } catch (e) {
                console.error("Failed to cleanup invalid certificate image:", e);
            }
            return res.status(200).json({ status: "ignored_missing_context" });
        }

        // Find user and update certificate image
        const user = await User.findById(userId);

        if (!user) {
            try {
                await deleteFile(fileName);
            } catch (e) {
                console.error("Failed to cleanup image for non-existent user:", e);
            }
            return res.status(200).json({ status: "ignored_user_not_found" });
        }

        // Find academic degree by ID
        const academicDegree = user.academicDegrees.id(degreeId);

        if (!academicDegree) {
            try {
                await deleteFile(fileName);
            } catch (e) {
                console.error("Failed to cleanup image for non-existent degree:", e);
            }
            return res.status(200).json({ status: "ignored_degree_not_found" });
        }

        // Validate: only image files allowed (no videos)
        const contentType = notification.contentType || "";
        const isImage = contentType.startsWith("image/");

        if (!isImage) {
            try {
                await deleteFile(fileName);
            } catch (e) {
                console.error("Failed to cleanup invalid file format:", e);
            }
            return res.status(200).json({
                status: "invalid_format",
                message: "Only image files are allowed for certificates",
            });
        }

        // Generate public URL
        const fileUrl = `https://storage.googleapis.com/${notification.bucket}/${fileName}`;

        // Delete old certificate image if exists
        if (academicDegree.certificateImage) {
            try {
                const oldUrlParts = academicDegree.certificateImage.split("/");
                const oldFileName = oldUrlParts.slice(4).join("/");
                await deleteFile(oldFileName);
            } catch (e) {
                console.error("Failed to delete old certificate image:", e);
            }
        }

        // Update degree with new certificate image URL
        academicDegree.certificateImage = fileUrl;
        await user.save();

        console.log(`handleCertificateImageWebhook successfully ${userId}`);
        res.status(200).json({
            status: "success",
            message: "Certificate image updated successfully",
            academicDegree: academicDegree,
        });
    } catch (error) {
        console.error("handleCertificateImageWebhook error:", error);
        res.status(500).json({
            status: "error",
            message: "Error processing certificate image webhook",
            error: error.message,
        });
    }
});
