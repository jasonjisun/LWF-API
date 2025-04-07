require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app"); // ✅ Ensure app is imported properly

const PORT = process.env.PORT || 8000;

// 🔌 MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Database Connected");

    // 🚀 Start the Server
    app.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1); // Exit process if DB connection fails
  });
