import { useState } from "react";
import { login, register } from "./api";
import "./AuthPage.css";

interface Props { onAuth: (token: string, user: { name: string; email: string }) => void; }

export default function AuthPage({ onAuth }: Props) {
  const [tab,      setTab]      = useState<"login" | "register">("login");
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      if (tab === "login") {
        const res = await login(email, password);
        onAuth(res.access_token, res.user);
      } else {
        const res = await register(name, email, password);
        onAuth(res.access_token, res.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-root">
      {/* ── Left panel ── */}
      <div className="auth-left">
        <div className="auth-nav">
          <div className="auth-brand-icon">⬡</div>
          <span className="auth-brand-name">DocuMind</span>
        </div>

        <div className="auth-hero">
          <div className="auth-eyebrow">
            <span className="eyebrow-dot" />
            AI-powered PDF assistant
          </div>
          <h1 className="auth-headline">
            Your documents,<br />
            now <span className="auth-grad">conversational</span>
          </h1>
          <p className="auth-subline">
            Upload any PDF — get an instant summary and ask questions in plain language.
            Precise answers, powered by semantic search and Gemini.
          </p>
        </div>

        {/* Mini product preview */}
        <div className="auth-preview">
          <div className="preview-bar">
            <span className="pb-dot pd-red"   />
            <span className="pb-dot pd-yellow"/>
            <span className="pb-dot pd-green" />
            <span className="preview-filename">Transformer Architecture.pdf</span>
            <span className="preview-badge">PDF</span>
          </div>
          <div className="preview-msgs">
            <div className="pm pm-ai">
              <div className="pm-av pm-av-ai">AI</div>
              <div className="pm-bubble pm-bubble-ai">
                This paper introduces the Transformer — an architecture based solely on attention mechanisms, eliminating recurrence entirely.
              </div>
            </div>
            <div className="pm pm-user">
              <div className="pm-av pm-av-user">N</div>
              <div className="pm-bubble pm-bubble-user">
                Why does multi-head attention outperform single-head?
              </div>
            </div>
            <div className="pm pm-ai">
              <div className="pm-av pm-av-ai">AI</div>
              <div className="pm-bubble pm-bubble-ai">
                Each head specializes in different relationships — one may track syntax, another semantics
                <span className="preview-cursor" />
              </div>
            </div>
          </div>
        </div>

        <div className="auth-chips">
          <div className="auth-chip">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            Instant summaries
          </div>
          <div className="auth-chip">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Semantic RAG
          </div>
          <div className="auth-chip">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Chat history
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-right">
        <div className="auth-form-card">
          <h2 className="auth-form-title">{tab === "login" ? "Sign in" : "Create account"}</h2>
          <p className="auth-form-sub">
            {tab === "login" ? "Welcome back. Access your documents." : "Start for free. No card required."}
          </p>

          <div className="auth-tabs">
            <button className={`auth-tab ${tab === "login"    ? "on" : ""}`} onClick={() => { setTab("login");    setError(""); }} type="button">Sign in</button>
            <button className={`auth-tab ${tab === "register" ? "on" : ""}`} onClick={() => { setTab("register"); setError(""); }} type="button">Create account</button>
          </div>

          <form onSubmit={handleSubmit}>
            {tab === "register" && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="f-name">Full name</label>
                <input id="f-name" className="auth-input" type="text"
                  placeholder="Nour Khammassi" value={name}
                  onChange={e => setName(e.target.value)} required />
              </div>
            )}
            <div className="auth-field">
              <label className="auth-label" htmlFor="f-email">Email address</label>
              <input id="f-email" className="auth-input" type="email"
                placeholder="nour@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="f-pw">Password</label>
              <input id="f-pw" className="auth-input" type="password"
                placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}