const Joi = require("joi");

exports.signupSchema = Joi.object({
  email: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({
      tlds: { allow: ["com", "net"] },
    }),
  password: Joi.string()
    .required()
    .pattern(new RegExp("^.{8,16}$")) // Allows 8-16 characters, no other restrictions
    .messages({
      "string.pattern.base": "Password must be between 8-16 characters.",
    }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match!",
  }),
  role: Joi.string().valid("admin", "doctor", "patient").default("patient"),
});

exports.signinSchema = Joi.object({
  email: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({
      tlds: { allow: ["com", "net"] },
    }),
  password: Joi.string()
    .required()
    .pattern(new RegExp("^.{8,16}$"))
    .messages({
      "string.pattern.base": "Password must be between 8-16 characters.",
    }),
  rememberMe: Joi.boolean().optional(),
});

exports.acceptCodeSchema = Joi.object({
  email: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({
      tlds: { allow: ["com", "net"] },
    }),
  providedCode: Joi.number(),
});

exports.changePasswordSchema = Joi.object({
  oldPassword: Joi.string()
    .required()
    .pattern(new RegExp("^.{8,16}$"))
    .messages({
      "string.pattern.base": "Password must be between 8-16 characters.",
    }),
  newPassword: Joi.string()
    .required()
    .pattern(new RegExp("^.{8,16}$"))
    .messages({
      "string.pattern.base": "Password must be between 8-16 characters.",
    }),
  confirmNewPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "New passwords do not match!",
    }),
});

exports.acceptFPCodeSchema = Joi.object({
  email: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({
      tlds: { allow: ["com", "net"] },
    }),
  providedCode: Joi.number().required(),
  newPassword: Joi.string()
    .required()
    .pattern(new RegExp("^.{8,16}$"))
    .messages({
      "string.pattern.base": "Password must be between 8-16 characters.",
    }),
});
