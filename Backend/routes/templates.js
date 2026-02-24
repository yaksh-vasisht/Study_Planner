const express = require("express");
const Template = require("../models/Template");
const StudyPlan = require("../models/StudyPlan");
const Subject = require("../models/Subject");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// Get all templates
router.get("/", async (req, res) => {
  try {
    const templates = await Template.find({ userId: req.userId }).sort({
      createdAt: -1,
    });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save current plan as template
router.post("/save", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Template name is required" });
    }

    // Get current week's plan
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    const currentPlan = await StudyPlan.findOne({
      userId: req.userId,
      weekNumber,
      year,
    });

    if (!currentPlan || currentPlan.sessions.length === 0) {
      return res.status(400).json({ error: "No active plan to save" });
    }

    // Convert plan sessions to template format (store day of week + time, not specific dates)
    const templateSessions = currentPlan.sessions.map((session) => {
      const sessionDate = new Date(session.scheduledStart);
      const dayOfWeek = sessionDate.toLocaleDateString("en-US", {
        weekday: "long",
      });
      const hours = sessionDate.getHours();
      const minutes = sessionDate.getMinutes();
      const startTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

      return {
        subjectId: session.subjectId,
        subjectName: session.subjectName,
        dayOfWeek,
        startTime,
        duration: session.allocated,
      };
    });

    // Calculate total hours
    const totalHours = templateSessions.reduce((sum, s) => sum + s.duration, 0);

    // Create template
    const template = new Template({
      userId: req.userId,
      name,
      description: description || "",
      sessions: templateSessions,
      totalHoursPerWeek: totalHours,
    });

    await template.save();
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Load template (create new plan from template)
router.post("/:id/load", async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    // Check if plan exists for current week
    let plan = await StudyPlan.findOne({
      userId: req.userId,
      weekNumber,
      year,
    });

    if (plan) {
      return res.status(400).json({
        error:
          "A plan already exists for this week. Clear it first or add sessions manually.",
      });
    }

    // Create new plan from template
    const sessions = [];

    for (const templateSession of template.sessions) {
      // Calculate the next occurrence of this day of week
      const targetDate = getNextDayOfWeek(templateSession.dayOfWeek);

      // Set the time
      const [hours, minutes] = templateSession.startTime.split(":");
      targetDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Calculate end time
      const endDate = new Date(targetDate);
      endDate.setHours(
        endDate.getHours() + Math.floor(templateSession.duration),
      );
      endDate.setMinutes(
        endDate.getMinutes() + (templateSession.duration % 1) * 60,
      );

      sessions.push({
        subjectId: templateSession.subjectId,
        subjectName: templateSession.subjectName,
        scheduledStart: targetDate,
        scheduledEnd: endDate,
        allocated: templateSession.duration,
        completed: false,
        status: "scheduled",
      });
    }

    // Create new plan
    plan = new StudyPlan({
      userId: req.userId,
      weekNumber,
      year,
      sessions,
    });

    await plan.save();
    res.status(201).json({
      message: `Template "${template.name}" loaded successfully`,
      plan,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template
router.delete("/:id", async (req, res) => {
  try {
    const template = await Template.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ message: "Template deleted successfully" });
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

module.exports = router;
