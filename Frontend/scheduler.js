// scheduler.js - The brain of our time-aware system

// This function generates a weekly plan with full date-time stamps
function generateWeeklySchedule(subjects, dailyHours, startTime, daysOfWeek) {
  // daysOfWeek is an array like ['Monday', 'Wednesday', 'Friday']
  // startTime is like "18:00"
  // dailyHours is hours available per study day

  const schedule = [];
  const today = new Date();

  // Figure out what day of the week it is (0 = Sunday, 1 = Monday, etc)
  const currentDayOfWeek = today.getDay();

  // Map day names to numbers
  const dayMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  // For each study day this week
  daysOfWeek.forEach((dayName) => {
    const targetDayNumber = dayMap[dayName];

    // Calculate how many days from now this study day is
    let daysUntil = targetDayNumber - currentDayOfWeek;
    if (daysUntil < 0) {
      daysUntil += 7; // If the day already passed this week, schedule for next week
    }

    // Create a date object for this study day
    const studyDate = new Date(today);
    studyDate.setDate(today.getDate() + daysUntil);

    // Parse the start time
    const [startHour, startMinute] = startTime.split(":").map(Number);
    studyDate.setHours(startHour, startMinute, 0, 0);

    // Now distribute subjects for this day
    // We'll use your existing scoring logic to decide which subjects to study
    const scoredSubjects = scoreSubjectsForDay(subjects, studyDate);
    const subjectsForDay = scoredSubjects.slice(0, dailyHours); // Pick top N subjects

    let currentTime = new Date(studyDate);

    subjectsForDay.forEach((subject) => {
      const sessionStart = new Date(currentTime);
      const sessionEnd = new Date(currentTime);
      sessionEnd.setHours(sessionEnd.getHours() + 1); // One hour session

      schedule.push({
        subjectName: subject.name,
        subjectId: subject.id || subject.name, // Unique identifier
        difficulty: subject.difficulty,
        priority: subject.priority,
        scheduledStart: sessionStart.toISOString(),
        scheduledEnd: sessionEnd.toISOString(),
        status: "scheduled", // scheduled, active, completed, or skipped
        actualStart: null, // When user actually started (if they did)
        actualEnd: null, // When user actually finished (if they did)
        dayOfWeek: dayName,
        weekNumber: getWeekNumber(studyDate), // Track which week this belongs to
      });

      // Move to next hour (plus break time)
      currentTime.setHours(currentTime.getHours() + 1);
      currentTime.setMinutes(currentTime.getMinutes() + 10); // 10 min break
    });
  });

  return schedule;
}

// Helper to get week number of the year
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Score subjects based on what should be studied on a particular day
function scoreSubjectsForDay(subjects, date) {
  // This uses your existing scoring logic but considers the specific day
  const scored = subjects.map((subject) => {
    let score = 0;

    // Check how many times this subject was studied this week already
    const weekSessions = getSubjectSessionsThisWeek(subject.name, date);

    // Subjects studied less this week get priority
    score += (5 - weekSessions.length) * 20; // Up to 100 points for unstudied subjects

    // Priority multiplier
    const priorityMultipliers = { high: 1.5, medium: 1.0, low: 0.7 };
    score *= priorityMultipliers[subject.priority] || 1.0;

    // Difficulty consideration - harder subjects on certain days
    if (date.getDay() === 2 || date.getDay() === 4) {
      // Tuesday or Thursday
      // These are good days for hard subjects (assuming rest after)
      if (subject.difficulty === "hard") score += 15;
    }

    return { ...subject, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}

// Get all sessions for a subject in the current week
function getSubjectSessionsThisWeek(subjectName, referenceDate) {
  const schedule = JSON.parse(localStorage.getItem("weeklySchedule")) || [];
  const refWeek = getWeekNumber(referenceDate);

  return schedule.filter(
    (session) =>
      session.subjectName === subjectName && session.weekNumber === refWeek,
  );
}

// This function runs every time any page loads
function updateScheduleHealth() {
  const schedule = JSON.parse(localStorage.getItem("weeklySchedule")) || [];
  const now = new Date();
  let scheduleChanged = false;

  schedule.forEach((session) => {
    const scheduledStart = new Date(session.scheduledStart);
    const scheduledEnd = new Date(session.scheduledEnd);

    // Skip sessions that are already marked completed
    if (session.status === "completed") {
      return;
    }

    // Check if this session is happening right now
    if (
      now >= scheduledStart &&
      now <= scheduledEnd &&
      session.status === "scheduled"
    ) {
      session.status = "active";
      scheduleChanged = true;
      console.log(`Session is active now: ${session.subjectName}`);
    }

    // Check if this session time has passed without completion
    if (now > scheduledEnd && session.status !== "completed") {
      session.status = "skipped";
      scheduleChanged = true;
      console.log(
        `Session was skipped: ${session.subjectName} on ${session.dayOfWeek}`,
      );

      // Record this skip in the subject's history
      recordSkippedSession(session);
    }
  });

  // If anything changed, save it back
  if (scheduleChanged) {
    localStorage.setItem("weeklySchedule", JSON.stringify(schedule));

    // Trigger a notification if there are skipped sessions today
    notifySkippedSessions(schedule);
  }

  return schedule;
}

// Record a skipped session in the subject's history
function recordSkippedSession(session) {
  const subjects = JSON.parse(localStorage.getItem("subjects")) || [];
  const subject = subjects.find((s) => s.name === session.subjectName);

  if (subject) {
    // Initialize skip tracking if it doesn't exist
    if (!subject.skippedSessions) {
      subject.skippedSessions = [];
    }

    // Add this skip to the history
    subject.skippedSessions.push({
      scheduledTime: session.scheduledStart,
      dayOfWeek: session.dayOfWeek,
      weekNumber: session.weekNumber,
    });

    // Also increment a simple skip counter for this week
    if (!subject.skipsThisWeek) {
      subject.skipsThisWeek = 0;
    }
    subject.skipsThisWeek += 1;

    localStorage.setItem("subjects", JSON.stringify(subjects));
  }
}

// Notify user about today's skipped sessions
function notifySkippedSessions(schedule) {
  const today = new Date().toDateString();
  const todaySkips = schedule.filter(
    (s) =>
      s.status === "skipped" &&
      new Date(s.scheduledStart).toDateString() === today,
  );

  if (todaySkips.length > 0) {
    // You could show a notification banner on the dashboard
    const skipMessage = `You've skipped ${todaySkips.length} session(s) today: ${todaySkips
      .map((s) => s.subjectName)
      .join(", ")}`;

    // Store this message to display on the dashboard
    localStorage.setItem("skipNotification", skipMessage);
  }
}
function calculateDynamicRecommendations() {
  // First, make sure schedule is up to date
  updateScheduleHealth();

  const subjects = JSON.parse(localStorage.getItem("subjects")) || [];
  const schedule = JSON.parse(localStorage.getItem("weeklySchedule")) || [];

  if (subjects.length === 0) return [];

  const now = new Date();
  const scoredSubjects = [];

  subjects.forEach((subject) => {
    let score = 0;

    // CRITICAL FACTOR: Skipped sessions this week
    // This gets the highest weight because skipped sessions represent broken commitments
    const skipsThisWeek = subject.skipsThisWeek || 0;
    score += skipsThisWeek * 100; // Each skip adds 100 points of urgency

    // Check if this subject was skipped TODAY specifically
    const todaySkips = schedule.filter(
      (s) =>
        s.subjectName === subject.name &&
        s.status === "skipped" &&
        new Date(s.scheduledStart).toDateString() === now.toDateString(),
    );
    if (todaySkips.length > 0) {
      score += 150; // Massive boost for subjects skipped today
    }

    // Weekly balance: how many sessions completed vs planned?
    const weekSessions = getSubjectSessionsThisWeek(subject.name, now);
    const completedThisWeek = weekSessions.filter(
      (s) => s.status === "completed",
    ).length;
    const plannedThisWeek = weekSessions.length;
    const completionRate =
      plannedThisWeek > 0 ? completedThisWeek / plannedThisWeek : 0;

    // Low completion rate means this subject is falling behind
    if (completionRate < 0.5 && plannedThisWeek > 0) {
      score += 80; // Subjects below 50% completion get boosted
    }

    // Priority still matters but is less important than actual progress
    const priorityMultipliers = { high: 1.3, medium: 1.0, low: 0.8 };
    score *= priorityMultipliers[subject.priority] || 1.0;

    // Prevent same-day repetition if already studied today
    const todayCompleted = schedule.filter(
      (s) =>
        s.subjectName === subject.name &&
        s.status === "completed" &&
        new Date(s.scheduledStart).toDateString() === now.toDateString(),
    );
    if (todayCompleted.length >= 2) {
      score *= 0.3; // Heavy penalty if already studied twice today
    }

    scoredSubjects.push({
      ...subject,
      recommendationScore: score,
      skipsThisWeek,
      completionRate: Math.round(completionRate * 100),
      todaySkips: todaySkips.length,
    });
  });

  return scoredSubjects.sort(
    (a, b) => b.recommendationScore - a.recommendationScore,
  );
}
