const express = require("express");
const StudyPlan = require("../models/StudyPlan");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// Get weekly progress
router.get("/weekly", async (req, res) => {
  try {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    const plan = await StudyPlan.findOne({
      userId: req.userId,
      weekNumber,
      year,
    });

    if (!plan) {
      return res.json({ total: 0, completed: 0, percentage: 0, sessions: [] });
    }

    const total = plan.sessions.length;
    const completed = plan.sessions.filter((s) => s.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      total,
      completed,
      percentage,
      sessions: plan.sessions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get streak
router.get("/streak", async (req, res) => {
  try {
    const plans = await StudyPlan.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(52); // Last year of plans

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const plan of plans) {
      const hasCompletedSession = plan.sessions.some((s) => {
        if (!s.completed) return false;
        const sessionDate = new Date(s.actualEnd || s.scheduledEnd);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === today.getTime();
      });

      if (hasCompletedSession) {
        streak++;
        today.setDate(today.getDate() - 1);
      } else {
        break;
      }
    }

    res.json({ streak });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = (date - firstDay) / 86400000;
  return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}

module.exports = router;
