// analytics.js - Analytics dashboard logic

console.log("Analytics page loaded");

// Check auth
const token = localStorage.getItem("token");
if (!token) {
  alert("Please login first");
  window.location.href = "login.html";
}

// ==================== SAMPLE DATA (Replace with API calls later) ====================

// Sample study data for the last 90 days
function generateSampleData() {
  const data = {};
  const today = new Date();

  for (let i = 0; i < 90; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    // Random hours (0-8), with some days having no study
    data[dateStr] = Math.random() > 0.2 ? Math.floor(Math.random() * 8) + 1 : 0;
  }

  return data;
}

// Sample weekly data
const sampleWeeklyData = {
  Monday: 4.5,
  Tuesday: 3.0,
  Wednesday: 5.5,
  Thursday: 6.0,
  Friday: 4.0,
  Saturday: 2.5,
  Sunday: 3.0,
};

// Sample subject distribution for today
const sampleSubjectData = {
  DSA: 2.5,
  DBMS: 2.0,
  Java: 1.5,
  OS: 1.0,
  Networks: 0.5,
};

// Sample total stats
const sampleStats = {
  totalHours: 156,
  completionRate: 87,
  activeSubjects: 5,
  currentStreak: 14,
  bestStreak: 21,
};

// ==================== LOAD DATA ====================

async function loadAnalytics() {
  console.log("Loading analytics...");

  try {
    // TODO: Replace with actual API calls
    // const stats = await analyticsAPI.getStats();
    // const weeklyData = await analyticsAPI.getWeekly();
    // const dailyData = await analyticsAPI.getDaily();
    // const subjectData = await analyticsAPI.getToday();

    // For now, use sample data
    loadTopStats(sampleStats);
    loadStreak(sampleStats.currentStreak, sampleStats.bestStreak);
    loadWeeklySummary(sampleWeeklyData);
    generateHeatmap(generateSampleData());
    createPieChart(sampleSubjectData);
    createLineChart(sampleWeeklyData);
  } catch (error) {
    console.error("Error loading analytics:", error);
  }
}

// ==================== TOP STATS ====================

function loadTopStats(stats) {
  document.getElementById("totalHours").textContent = stats.totalHours;
  document.getElementById("completionRate").textContent =
    stats.completionRate + "%";
  document.getElementById("activeSubjects").textContent = stats.activeSubjects;
}

// ==================== STREAK ====================

function loadStreak(current, best) {
  document.getElementById("streakNumber").textContent = `🔥 ${current}`;

  // Calculate next milestone
  const milestones = [7, 14, 30, 60, 100];
  const nextMilestone = milestones.find((m) => m > current) || current + 30;
  const daysToGo = nextMilestone - current;

  document.getElementById("nextMilestone").textContent =
    `🏆 Next milestone: ${nextMilestone} days (${daysToGo} days to go!)`;

  document.getElementById("personalBest").textContent =
    `💪 Personal best: ${best} days`;
}

// ==================== WEEKLY SUMMARY ====================

function loadWeeklySummary(weekData) {
  const container = document.getElementById("weeklySummary");
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Find best day
  let maxHours = 0;
  let bestDay = "";
  Object.entries(weekData).forEach(([day, hours]) => {
    if (hours > maxHours) {
      maxHours = hours;
      bestDay = day;
    }
  });

  let html = "";
  days.forEach((day) => {
    const hours = weekData[day] || 0;
    const isBest = day === bestDay && hours > 0;

    html += `
            <div class="day-row">
                <span class="day-label">${day}</span>
                <span class="day-hours ${isBest ? "best" : ""}">
                    ${hours.toFixed(1)}h ${isBest ? "⭐" : ""}
                </span>
            </div>
        `;
  });

  container.innerHTML = html;
}

// ==================== HEATMAP ====================

function generateHeatmap(studyData) {
  const grid = document.getElementById("heatmapGrid");
  grid.innerHTML = "";

  const days = 90;
  const today = new Date();

  // Group by weeks
  const weeks = [];
  let currentWeek = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const hours = studyData[dateStr] || 0;

    currentWeek.push({ date: dateStr, hours, day: date.getDay() });

    if (date.getDay() === 6 || i === 0) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  }

  // Render weeks
  weeks.forEach((week) => {
    const weekCol = document.createElement("div");
    weekCol.className = "heatmap-week";

    // Fill empty days at start of first week
    const firstDay = week[0].day;
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.style.width = "12px";
      empty.style.height = "12px";
      weekCol.appendChild(empty);
    }

    week.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";

      // Color based on hours
      if (day.hours === 0) cell.classList.add("level-0");
      else if (day.hours <= 2) cell.classList.add("level-1");
      else if (day.hours <= 4) cell.classList.add("level-2");
      else if (day.hours <= 6) cell.classList.add("level-3");
      else cell.classList.add("level-4");

      cell.title = `${day.date}: ${day.hours} hours`;
      weekCol.appendChild(cell);
    });

    grid.appendChild(weekCol);
  });
}

// ==================== PIE CHART ====================

function createPieChart(subjectData) {
  const ctx = document.getElementById("pieChart").getContext("2d");

  const labels = Object.keys(subjectData);
  const data = Object.values(subjectData);

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: [
            "#667eea",
            "#764ba2",
            "#f093fb",
            "#4ecdc4",
            "#ffd93d",
            "#ff6b6b",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 15,
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.label + ": " + context.parsed + "h";
            },
          },
        },
      },
    },
  });
}

// ==================== LINE CHART ====================

function createLineChart(weekData) {
  const ctx = document.getElementById("lineChart").getContext("2d");

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const data = [
    weekData["Monday"],
    weekData["Tuesday"],
    weekData["Wednesday"],
    weekData["Thursday"],
    weekData["Friday"],
    weekData["Saturday"],
    weekData["Sunday"],
  ];

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Hours Studied",
          data: data,
          borderColor: "#667eea",
          backgroundColor: "rgba(102, 126, 234, 0.1)",
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: "#667eea",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.parsed.y + " hours";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 8,
          ticks: {
            callback: function (value) {
              return value + "h";
            },
          },
        },
      },
    },
  });
}

// ==================== INITIALIZE ====================

loadAnalytics();
