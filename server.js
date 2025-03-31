require("dotenv").config();
require("./middlewares/passport");

const express = require("express");
const passport = require("passport");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const userRoutes = require("./routes/userRoutes");

const authRoutes = require("./routes/authRoutes");

const app = express();

// 🔒 Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:5173", // Change this to match your frontend URL
    credentials: true, // Allow cookies/session sharing
  })
);
app.use(cookieParser());

// 🛠 Express Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡 Session Management (Required for Passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false, // Better for security
  })
);

// 🔑 Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());

// 🔌 MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Database Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// 📌 Authentication Routes
app.use("/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);

// 🎯 Base API Route
app.get("/", (req, res) => {
  res.json({ message: "🚀 Server is running!" });
});

// 🚀 Start the Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
