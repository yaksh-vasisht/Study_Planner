const express = require("express");
const StudyPlan = require("../models/StudyPlan");
const Subject = require("../models/Subject");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// Get current week's plan
router.get("/current", async (req, res) => {
  try {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    let plan = await StudyPlan.findOne({
      userId: req.userId,
      weekNumber,
      year,
    }).populate("sessions.subjectId");

    if (!plan) {
      // Return consistent empty structure
      return res.json({ sessions: [] });
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate plan
router.post("/generate", async (req, res) => {
  try {
    const { hours, startTime, daysOfWeek } = req.body;
    const subjects = await Subject.find({ userId: req.userId });

    if (subjects.length === 0) {
      return res.status(400).json({ error: "No subjects found" });
    }

    // Score and sort subjects
    const scoredSubjects = subjects
      .map((s) => ({
        ...s.toObject(),
        score: calculateScore(s),
      }))
      .sort((a, b) => b.score - a.score);

    // Generate sessions
    const sessions = [];
    const now = new Date();
    const weekNumber = getWeekNumber(now);

    daysOfWeek.forEach((day) => {
      const studyDate = getNextDayOfWeek(day);
      let currentTime = new Date(studyDate);
      const [h, m] = startTime.split(":");
      currentTime.setHours(parseInt(h), parseInt(m), 0, 0);

      let remainingHours = hours;
      let subjectIndex = 0;

      while (remainingHours > 0 && subjectIndex < scoredSubjects.length) {
        const subject = scoredSubjects[subjectIndex];
        const allocation = Math.min(
          subject.difficulty === "hard" ? 2 : 1,
          remainingHours,
        );

        const sessionStart = new Date(currentTime);
        const sessionEnd = new Date(
          currentTime.getTime() + allocation * 60 * 60 * 1000,
        );

        sessions.push({
          subjectId: subject._id,
          subjectName: subject.name,
          scheduledStart: sessionStart,
          scheduledEnd: sessionEnd,
          allocated: allocation,
          completed: false,
          status: "scheduled",
        });

        currentTime = new Date(sessionEnd.getTime() + 10 * 60 * 1000); // 10 min break
        remainingHours -= allocation;
        subjectIndex++;
      }
    });

    // Save plan
    const plan = new StudyPlan({
      userId: req.userId,
      weekNumber,
      year: now.getFullYear(),
      sessions,
    });

    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark session complete
router.post("/complete/:sessionId", async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({
      userId: req.userId,
      "sessions._id": req.params.sessionId,
    });

    if (!plan) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = plan.sessions.id(req.params.sessionId);
    session.completed = true;
    session.status = "completed";
    session.actualEnd = new Date();

    await plan.save();

    // Update subject
    await Subject.findByIdAndUpdate(session.subjectId, {
      lastStudied: new Date(),
      $inc: { totalHours: session.allocated },
    });

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete single session
router.delete("/session/:sessionId", async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({
      userId: req.userId,
      "sessions._id": req.params.sessionId,
    });

    if (!plan) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Remove session from array
    plan.sessions.id(req.params.sessionId).remove();
    await plan.save();

    res.json({ message: "Session deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update session duration
router.put("/session/:sessionId/duration", async (req, res) => {
  try {
    const { duration } = req.body;

    if (!duration || duration < 0.5) {
      return res.status(400).json({ error: "Invalid duration" });
    }

    const plan = await StudyPlan.findOne({
      userId: req.userId,
      "sessions._id": req.params.sessionId,
    });

    if (!plan) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = plan.sessions.id(req.params.sessionId);
    const oldDuration = session.allocated;

    // Update duration and end time
    session.allocated = duration;
    const startTime = new Date(session.scheduledStart);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + Math.floor(duration));
    endTime.setMinutes(endTime.getMinutes() + (duration % 1) * 60);
    session.scheduledEnd = endTime;

    await plan.save();

    res.json({
      message: "Duration updated successfully",
      session,
      oldDuration,
      newDuration: duration,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add manual session
router.post("/session", async (req, res) => {
  try {
    const { subjectId, day, time, duration } = req.body;

    if (!subjectId || !day || !time || !duration) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get subject
    const subject = await Subject.findOne({
      _id: subjectId,
      userId: req.userId,
    });
    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    // Find or create plan for current week
    let plan = await StudyPlan.findOne({
      userId: req.userId,
      weekNumber,
      year,
    });

    if (!plan) {
      plan = new StudyPlan({
        userId: req.userId,
        weekNumber,
        year,
        sessions: [],
      });
    }

    // Calculate session dates
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const targetDayIndex = daysOfWeek.indexOf(day);
    const currentDayIndex = now.getDay();

    let daysUntil = targetDayIndex - currentDayIndex;
    if (daysUntil < 0) daysUntil += 7;

    const sessionDate = new Date(now);
    sessionDate.setDate(now.getDate() + daysUntil);

    // Set the time
    const [hours, minutes] = time.split(":");
    sessionDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Create end time
    const endDate = new Date(sessionDate);
    endDate.setHours(endDate.getHours() + Math.floor(duration));
    endDate.setMinutes(endDate.getMinutes() + (duration % 1) * 60);

    // Add session to plan
    plan.sessions.push({
      subjectId: subject._id,
      subjectName: subject.name,
      scheduledStart: sessionDate,
      scheduledEnd: endDate,
      allocated: duration,
      completed: false,
      status: "scheduled",
    });

    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all sessions (delete current week's plan)
router.delete("/current", async (req, res) => {
  try {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    const result = await StudyPlan.findOneAndDelete({
      userId: req.userId,
      weekNumber,
      year,
    });

    if (!result) {
      return res.status(404).json({ error: "No plan found for current week" });
    }

    res.json({
      message: "All sessions cleared successfully",
      deleted: result.sessions.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = (date - firstDay) / 86400000;
  return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}

function getNextDayOfWeek(dayName) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const targetDay = days.indexOf(dayName);
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
  const result = new Date(today);
  result.setDate(today.getDate() + daysUntil);
  return result;
}

function calculateScore(subject) {
  const difficultyScore = { easy: 1, medium: 2, hard: 3 };
  const priorityBonus = { low: 0.8, medium: 1.0, high: 1.2 };
  return (
    (difficultyScore[subject.difficulty] || 1) *
    (priorityBonus[subject.priority] || 1)
  );
}

module.exports = router;
