require("dotenv").config();
require("./middlewares/passport");

const express = require("express");
const passport = require("passport");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true, 
  })
);
app.use(cookieParser());


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false, 
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({ message: "🚀 Server is running!" });
});

module.exports = app;
