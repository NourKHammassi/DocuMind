const BASE = "http://localhost:8000";

function getToken() {
  return localStorage.getItem("token");
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export async function register(email: string, password: string, name: string) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function login(email: string, password: string) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function uploadPDF(file: File) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function summarize(docId: string) {
  return apiFetch(`/documents/${docId}/summarize`, { method: "POST" });
}

export async function ask(docId: string, question: string) {
  return apiFetch(`/documents/${docId}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export async function listDocuments() {
  return apiFetch("/documents/");
}

export async function getConversations(docId: string) {
  return apiFetch(`/documents/${docId}/conversations`);
}

export async function deleteDocument(docId: string) {
  return apiFetch(`/documents/${docId}`, { method: "DELETE" });
}