require("dotenv").config();
require("./middlewares/passport");
const path = require("path");
const express = require("express");
const cron = require("node-cron");
const passport = require("passport");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require('./routes/doctorRoutes');
const emrRoutes = require("./routes/emrRoutes");
const patientRoutes = require('./routes/patientRoutes');
const patientProfileRoutes = require('./routes/patientProfileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminProfileRoutes = require('./routes/adminProfileRoutes');
const queueRoutes = require('./routes/queueRoutes');
const logsRoutes = require('./routes/logsRoutes'); 

const app = express();

// 🔒 Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: "https://appointment-lwf-queue.onrender.com", // Change this to match your frontend URL
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
app.use("/api/emr", emrRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminProfileRoutes);
app.use('/api/patient', patientProfileRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/logs', logsRoutes);

app.use(express.static(path.join(__dirname, "dist")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// 🎯 Base API Route
app.get("/", (req, res) => {
  res.json({ message: "🚀 Server is running!" });
});

const pingServer = () => {
  http
    .get("https://appointment-lwf-queue.onrender.com", (res) => {
      console.log("Pinged server, status code:", res.statusCode);
    })
    .on("error", (err) => {
      console.error("Error pinging server:", err.message);
    });
};

// 🚀 Start the Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  cron.schedule("*/5 * * * *", pingServer)
});