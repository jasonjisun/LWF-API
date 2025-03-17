const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Ensures uniqueness while allowing null values
    },
    email: {
      type: String,
      trim: true,
      unique: true, // Keeps email unique but not required (for Google users)
      sparse: true, // Prevents indexing conflicts when missing
      lowercase: true,
    },
    password: {
      type: String,
      trim: true,
      select: false,
    },
    role:{
    type: String,
    enum: ["admin", "staff", "patient"],
    required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      select: false,
    },
    verificationCodeValidation: {
      type: Number,
      select: false,
    },
    forgotPasswordCode: {
      type: String,
      select: false,
    },
    forgotPasswordCodeValidation: {
      type: Number,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// 📌 Ensures email is required **only** if no Google ID exists
userSchema.pre("save", function (next) {
  if (!this.googleId && !this.email) {
    return next(new Error("Email is required for non-Google users!"));
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
