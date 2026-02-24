const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const subjectRoutes = require("./routes/subjects");
const planRoutes = require("./routes/plans");
const progressRoutes = require("./routes/progress");
const templateRoutes = require("./routes/templates");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/templates", templateRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Study Planner API running" });
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

module.exports = app;
