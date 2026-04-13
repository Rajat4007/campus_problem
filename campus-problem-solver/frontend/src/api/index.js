const BASE = process.env.REACT_APP_API_URL || "https://campus-backend-62mu.onrender.com/stats-public";

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.status);
  }
  return res.json();
}

export const api = {
  classify:     (description)              => req("POST", "/classify", { description }),
  submit:       (description, student_id)  => req("POST", "/problems", { description, student_id }),
  getByStudent: (student_id)               => req("GET",  `/problems/student/${student_id}`),
  getById:      (id)                       => req("GET",  `/problems/${id}`),
  adminLogin:   (username, password)       => req("POST", "/admin/login", { username, password }),
  getAll:       (token)                    => req("GET",  "/problems", null, token),
  updateStatus: (id, status, resolution, token) =>
    req("PATCH", `/problems/${id}`, { status, resolution }, token),
  getStats:     (token)                    => req("GET",  "/stats", null, token),
};