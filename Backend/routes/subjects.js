const express = require("express");
const Subject = require("../models/Subject");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// All routes protected
router.use(authMiddleware);

// Get all subjects
router.get("/", async (req, res) => {
  try {
    const subjects = await Subject.find({ userId: req.userId });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create subject
router.post("/", async (req, res) => {
  try {
    const { name, difficulty, priority } = req.body;

    const subject = new Subject({
      userId: req.userId,
      name,
      difficulty,
      priority,
      lastStudied: new Date(),
      totalHours: 0,
      skipsThisWeek: 0,
    });

    await subject.save();
    res.status(201).json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update subject
router.put("/:id", async (req, res) => {
  try {
    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true },
    );

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    res.json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete subject
router.delete("/:id", async (req, res) => {
  try {
    const subject = await Subject.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    res.json({ message: "Subject deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recommendations
router.get("/recommendations", async (req, res) => {
  try {
    const subjects = await Subject.find({ userId: req.userId });

    if (subjects.length === 0) {
      return res.json([]);
    }

    const now = new Date();
    const avgHours =
      subjects.reduce((sum, s) => sum + s.totalHours, 0) / subjects.length;

    const scoredSubjects = subjects.map((subject) => {
      let score = 0;

      const daysSinceStudied = Math.floor(
        (now - subject.lastStudied) / (1000 * 60 * 60 * 24),
      );
      score += daysSinceStudied * 10;

      const priorityMultipliers = { high: 1.5, medium: 1.0, low: 0.7 };
      score *= priorityMultipliers[subject.priority];

      if (subject.totalHours < avgHours) {
        score += (avgHours - subject.totalHours) * 5;
      }

      const difficultyBonus = { hard: 15, medium: 5, easy: 0 };
      score += difficultyBonus[subject.difficulty];

      score += subject.skipsThisWeek * 50;

      return {
        ...subject.toObject(),
        recommendationScore: score,
        daysSinceStudied,
      };
    });

    scoredSubjects.sort(
      (a, b) => b.recommendationScore - a.recommendationScore,
    );
    res.json(scoredSubjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
