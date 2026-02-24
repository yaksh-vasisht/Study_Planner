// api.js - Handles all API calls to backend
const API_URL = "http://localhost:5000/api";

// Get token from localStorage
function getToken() {
  return localStorage.getItem("token");
}

// Check if user is authenticated
function isAuthenticated() {
  const token = getToken();
  console.log("Checking auth, token:", token ? "exists" : "null");
  return !!token;
}

// Auth API
const authAPI = {
  async register(name, email, password, year) {
    console.log("Registering user:", { name, email, year });

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, year }),
      });

      console.log("Register response status:", res.status);
      const data = await res.json();
      console.log("Register response data:", data);

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        console.log("Token saved:", data.token.substring(0, 20) + "...");
      }

      return data;
    } catch (error) {
      console.error("Register error:", error);
      return { error: error.message };
    }
  },

  async login(email, password) {
    console.log("Logging in user:", email);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      console.log("Login response status:", res.status);
      const data = await res.json();
      console.log("Login response data:", data);

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        console.log("Token saved:", data.token.substring(0, 20) + "...");
      } else {
        console.error("No token in response!");
      }

      return data;
    } catch (error) {
      console.error("Login error:", error);
      return { error: error.message };
    }
  },

  logout() {
    console.log("Logging out");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "index.html";
  },

  getUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },
};

// Subjects API
const subjectsAPI = {
  async getAll() {
    const res = await fetch(`${API_URL}/subjects`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401) {
      alert("Session expired. Please login again.");
      authAPI.logout();
      return [];
    }

    return await res.json();
  },

  async create(name, difficulty, priority) {
    const res = await fetch(`${API_URL}/subjects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ name, difficulty, priority }),
    });

    if (res.status === 401) {
      alert("Session expired. Please login again.");
      authAPI.logout();
      return { error: "Unauthorized" };
    }

    return await res.json();
  },

  async update(id, data) {
    const res = await fetch(`${API_URL}/subjects/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async delete(id) {
    const res = await fetch(`${API_URL}/subjects/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return await res.json();
  },

  async getRecommendations() {
    const res = await fetch(`${API_URL}/subjects/recommendations`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401) {
      return [];
    }

    return await res.json();
  },
};

// Plans API
const plansAPI = {
  async getCurrent() {
    const res = await fetch(`${API_URL}/plans/current`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401) {
      return { sessions: [] };
    }

    return await res.json();
  },

  async generate(hours, startTime, daysOfWeek) {
    const res = await fetch(`${API_URL}/plans/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ hours, startTime, daysOfWeek }),
    });
    return await res.json();
  },

  async completeSession(sessionId) {
    const res = await fetch(`${API_URL}/plans/complete/${sessionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return await res.json();
  },

  async deleteSession(sessionId) {
    const res = await fetch(`${API_URL}/plans/session/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return await res.json();
  },

  async updateDuration(sessionId, duration) {
    const res = await fetch(`${API_URL}/plans/session/${sessionId}/duration`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ duration }),
    });
    return await res.json();
  },

  async addSession(subjectId, day, time, duration) {
    const res = await fetch(`${API_URL}/plans/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ subjectId, day, time, duration }),
    });
    return await res.json();
  },

  async clearAll() {
    const res = await fetch(`${API_URL}/plans/current`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    // Handle 404 as success (no plan to delete)
    if (res.status === 404) {
      return { message: "No sessions to clear", deleted: 0 };
    }

    if (!res.ok) {
      throw new Error(`Failed to clear sessions: ${res.status}`);
    }

    return await res.json();
  },
};

// Progress API
const progressAPI = {
  async getWeekly() {
    const res = await fetch(`${API_URL}/progress/weekly`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401) {
      return { total: 0, completed: 0, percentage: 0, sessions: [] };
    }

    return await res.json();
  },

  async getStreak() {
    const res = await fetch(`${API_URL}/progress/streak`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401) {
      return { streak: 0 };
    }

    return await res.json();
  },
};

// Templates API
const templatesAPI = {
  async getAll() {
    const res = await fetch(`${API_URL}/templates`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401) {
      return [];
    }

    return await res.json();
  },

  async save(name, description) {
    const res = await fetch(`${API_URL}/templates/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ name, description }),
    });
    return await res.json();
  },

  async load(templateId) {
    const res = await fetch(`${API_URL}/templates/${templateId}/load`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return await res.json();
  },

  async delete(templateId) {
    const res = await fetch(`${API_URL}/templates/${templateId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return await res.json();
  },
};
