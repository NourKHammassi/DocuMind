import { useState } from "react";
import { login, register } from "./api";

interface Props {
  onAuth: (token: string, user: { name: string; email: string }) => void;
}

export default function AuthPage({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = mode === "login"
        ? await login(email, password)
        : await register(email, password, name);
      localStorage.setItem("token", data.access_token);
      onAuth(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-brand">
            <span className="auth-brand-icon">⬡</span>
            <span className="auth-brand-name">DocuMind</span>
          </div>
          <h2 className="auth-headline">
            Turn any PDF into<br />a conversation
          </h2>
          <p className="auth-sub">
            Upload your document. Get an instant summary.<br />
            Ask anything — get precise answers.
          </p>
          <div className="auth-features">
  <div className="auth-feature">
    <svg className="feat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
    <span>Instant AI summaries</span>
  </div>
  <div className="auth-feature">
    <svg className="feat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span>Context-aware Q&A</span>
  </div>
  <div className="auth-feature">
    <svg className="feat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
    <span>Persistent history</span>
  </div>
</div>
        </div>
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <h3 className="auth-card-title">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h3>
          <p className="auth-card-sub">
            {mode === "login"
              ? "Sign in to access your documents"
              : "Start analyzing documents in seconds"}
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "register" && (
              <div className="field-group">
                <label>Full name</label>
                <input
                  type="text"
                  placeholder="Nour Khammassi"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="field-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="nour@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="btn-dots">
                  <span /><span /><span />
                </span>
              ) : mode === "login" ? "Sign in" : "Get started"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}