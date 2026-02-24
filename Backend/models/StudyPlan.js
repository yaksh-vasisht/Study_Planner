const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  subjectName: String,
  scheduledStart: Date,
  scheduledEnd: Date,
  actualStart: Date,
  actualEnd: Date,
  allocated: Number,
  completed: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["scheduled", "active", "completed", "skipped"],
    default: "scheduled",
  },
});

const planSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  weekNumber: Number,
  year: Number,
  sessions: [sessionSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("StudyPlan", planSchema);
