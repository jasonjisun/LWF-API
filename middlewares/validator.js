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
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*d).{8,}$")),
  role: Joi
  .string()
  .valid("admin", "staff", "patient")
  .required(),
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
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*d).{8,}$")),
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
  newPassword: Joi.string()
    .required()
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*d).{8,}$")),
  oldPassword: Joi.string()
    .required()
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*d).{8,}$")),
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
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*d).{8,}$")),
});
