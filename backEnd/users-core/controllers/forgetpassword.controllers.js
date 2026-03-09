const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const passwordComplexity = require("joi-password-complexity");
const xss = require("xss");
const Joi = require("joi");
const emailService = require("../util/sendGemail");
const {
  generateTokenAndSend,
} = require("../../middlewares/genarattokenandcookies");
const { getUserModel } = require("../../models/users-core/users.models");
const User = getUserModel();

const complexityOptions = {
  min: 8,
  max: 30,
  lowerCase: 1,
  upperCase: 1,
  numeric: 1,
  symbol: 1,
  requirementCount: 4,
};

/**
 * إرسال بريد إعادة تعيين كلمة المرور
 */
exports.sendResetPasswordEmail = asyncHandler(async (req, res) => {
  const email = xss(req.body.email);
  const { error } = validateEmail({ email });
  if (error) return res.status(400).json({ error: error.details[0].message });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "User not found" });

  const resetCode = Math.floor(100000 + Math.random() * 900000);
  user.resetPasswordCode = resetCode;

  try {
    await user.save();
    const result = await emailService.sendPasswordResetEmail({
      to: user.email,
      resetToken: resetCode,
      username: user.username || user.email,
    });

    if (!result || !result.success)
      return res.status(500).json({ error: "Failed to send email" });

    res.status(200).json({ message: "Reset password code sent successfully" });

    console.log(`sendResetPasswordEmail successfully ${user._id}`)
  } catch (err) {
    res.status(500).json({ error: "Failed to send email" });
    console.log(`sendResetPasswordEmail successfully ${user._id}`)
  }
});

/**
 * التحقق من الكود المرسل
 */
exports.validateResetPasswordCode = asyncHandler(async (req, res) => {
  const email = xss(req.body.email);
  const code = xss(req.body.code);

  const { error } = validateEmail({ email });
  if (error) return res.status(400).json({ error: error.details[0].message });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.resetPasswordCode !== code)
    return res.status(400).json({ error: "Invalid code" });

  res.status(200).json({ message: "Code is valid" });

  console.log(`validateResetPasswordCode successfully ${user._id}`)
});

/**
 * إعادة تعيين كلمة المرور
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  try {
    const email = xss(req.body.email);
    const password = xss(req.body.password);

    const { error } = validatePassword({ password });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordCode = null;
    await user.save();

    res.clearCookie("auth-token");
    res.setHeader("auth-token", "");
    generateTokenAndSend(user, res);

    res.status(200).json({ message: "Password reset successfully" });

    console.log(`resetPassword successfully ${user._id}`)
  } catch (error) {
    res.status(500).json({ error: "Failed to reset password" });
    console.log(`resetPassword successfully ${user._id}`)
  }
});

/**
 * التحقق من صحة البريد
 */
function validateEmail(data) {
  const schema = Joi.object({ email: Joi.string().email().required() });
  return schema.validate(data);
}

/**
 * التحقق من قوة كلمة المرور
 */
function validatePassword(data) {
  const schema = Joi.object({
    password: passwordComplexity(complexityOptions).required(),
  });
  return schema.validate(data);
}
