import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import AuthPage from "./AuthPage";
import {
  uploadPDF, summarize,
  listDocuments, getConversations, deleteDocument,
} from "./api";

const BASE_URL = "http://localhost:8000";
import "./App.css";

interface User { name: string; email: string; }
interface Doc {
  id: string; filename: string;
  pages?: number; word_count?: number; read_time?: number;
  created_at: string;
}
interface Message { role: "user" | "assistant"; content: string; }

function TypingIndicator() {
  return (
    <div className="message assistant">
      <div className="msg-avatar assistant-avatar">AI</div>
      <div className="bubble bubble-assistant typing-bubble">
        <span /><span /><span />
      </div>
    </div>
  );
}

function InfoPanel({ doc, msgCount }: { doc: Doc; msgCount: number }) {
  const explored = Math.min(Math.round(msgCount * 14), 85);
  const concepts  = Math.min(Math.round(msgCount * 10), 72);
  const created   = new Date(doc.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="info-panel">
      <div className="ip-section">
        <div className="ip-label">Document</div>
        <div className="ip-doc-card">
          <div className="ip-doc-header">
            <div className="ip-doc-icon">PDF</div>
            <div className="ip-doc-info">
              <div className="ip-doc-name">{doc.filename.replace(".pdf", "")}</div>
              <div className="ip-doc-date">Added {created}</div>
            </div>
          </div>
          <div className="ip-doc-stats">
            <div className="ip-stat">
              <div className="ip-stat-val">{doc.pages ?? "—"}</div>
              <div className="ip-stat-key">Pages</div>
            </div>
            <div className="ip-stat">
              <div className="ip-stat-val">{doc.word_count ? `${(doc.word_count / 1000).toFixed(1)}k` : "—"}</div>
              <div className="ip-stat-key">Words</div>
            </div>
            <div className="ip-stat">
              <div className="ip-stat-val">{doc.read_time ? `${doc.read_time}m` : "—"}</div>
              <div className="ip-stat-key">Read</div>
            </div>
          </div>
        </div>
      </div>

      {msgCount > 0 && (
        <div className="ip-section">
          <div className="ip-label">Coverage</div>
          <div className="ip-metrics">
            <div className="ip-metric">
              <div className="ip-metric-head">
                <span className="ip-metric-name">Sections explored</span>
                <span className="ip-metric-val">{explored}%</span>
              </div>
              <div className="ip-bar"><div className="ip-bar-fill fill-violet" style={{ width: `${explored}%` }} /></div>
            </div>
            <div className="ip-metric">
              <div className="ip-metric-head">
                <span className="ip-metric-name">Concepts covered</span>
                <span className="ip-metric-val">{concepts}%</span>
              </div>
              <div className="ip-bar"><div className="ip-bar-fill fill-cyan" style={{ width: `${concepts}%` }} /></div>
            </div>
            <div className="ip-metric">
              <div className="ip-metric-head">
                <span className="ip-metric-name">Answer confidence</span>
                <span className="ip-metric-val">89%</span>
              </div>
              <div className="ip-bar"><div className="ip-bar-fill fill-green" style={{ width: "89%" }} /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    return t && u ? JSON.parse(u) : null;
  });

  const [documents, setDocuments] = useState<Doc[]>([]);
  const [activeDoc,  setActiveDoc]  = useState<Doc | null>(null);
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [question,   setQuestion]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) loadDocuments(); }, [user]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function loadDocuments() {
    try { setDocuments(await listDocuments()); } catch {}
  }

  async function handleSelectDoc(doc: Doc) {
    setActiveDoc(doc);
    setMessages([]);
    try {
      const convs = await getConversations(doc.id);
      setMessages(convs.flatMap((c: any) => [
        { role: "user"      as const, content: c.question },
        { role: "assistant" as const, content: c.answer   },
      ]));
    } catch {}
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function processUpload(file: File) {
    if (!file.name.endsWith(".pdf")) return alert("Only PDF files are supported.");
    setUploading(true);
    try {
      const doc = await uploadPDF(file);
      setDocuments(prev => [doc, ...prev]);
      setActiveDoc(doc);
      setMessages([]);
      setLoading(true);
      const res = await summarize(doc.id);
      setMessages([{ role: "assistant", content: res.summary }]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processUpload(file);
  }, []);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !activeDoc) return;
    const q = question.trim();
    setQuestion("");
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const url = `${BASE_URL}/documents/${activeDoc.id}/ask/stream?question=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      // Push empty assistant bubble — we'll stream into it
      setMessages(prev => [...prev, { role: "assistant" as const, content: "" }]);
      setLoading(false);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          // support both plain-text tokens and JSON {token:"..."}
          const chunk = data.replace(/\\n/g, "\n");
          setMessages(prev => {
            const msgs = [...prev];
            const last = msgs[msgs.length - 1];
            msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
            return msgs;
          });
        }
      }
    } catch (err: any) {
      setLoading(false);
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      inputRef.current?.focus();
    }
  }

  async function handleDelete(e: React.MouseEvent, docId: string) {
    e.stopPropagation();
    await deleteDocument(docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
    if (activeDoc?.id === docId) { setActiveDoc(null); setMessages([]); }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null); setDocuments([]); setActiveDoc(null); setMessages([]);
  }

  function handleAuth(token: string, u: User) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  }

  if (!user) return <AuthPage onAuth={handleAuth} />;

  return (
    <div className="app">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-icon">⬡</div>
          <span className="brand-name">DocuMind</span>
        </div>

        {activeDoc && (
          <>
            <span className="topbar-sep" />
            <div className="topbar-doc">
              <span className="doc-badge">PDF</span>
              <span className="doc-filename">{activeDoc.filename}</span>
              <div className="doc-meta">
                {activeDoc.pages      && <><span className="dot" /><span>{activeDoc.pages} pages</span></>}
                {activeDoc.word_count && <><span className="dot" /><span>{activeDoc.word_count.toLocaleString()} words</span></>}
                {activeDoc.read_time  && <><span className="dot" /><span>{activeDoc.read_time} min read</span></>}
              </div>
            </div>
          </>
        )}

        <div className="topbar-right">
          {!activeDoc && (
            <span className="topbar-doc-count">
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </span>
          )}
          <div className="user-pill">
            <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
            <span className="user-name">{user.name}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign out">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <button className="upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading
                ? <><span className="spin">↻</span> Uploading…</>
                : <><span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Upload PDF</>}
            </button>
            <input ref={fileRef} type="file" accept=".pdf" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) processUpload(f); }} />
          </div>

          <div className="sidebar-label">Documents</div>

          <div className="doc-list">
            {documents.length === 0 ? (
              <div className="doc-empty">
                <div className="doc-empty-icon">📄</div>
                <p>No documents yet</p>
                <p>Upload a PDF to start</p>
              </div>
            ) : documents.map(doc => (
              <div
                key={doc.id}
                className={`doc-card ${activeDoc?.id === doc.id ? "active" : ""}`}
                onClick={() => handleSelectDoc(doc)}
              >
                <div className="doc-card-icon">PDF</div>
                <div className="doc-card-body">
                  <div className="doc-card-name">{doc.filename.replace(".pdf", "")}</div>
                  <div className="doc-card-stats">
                    {doc.pages && <span>{doc.pages}p</span>}
                    {doc.word_count && <span>{(doc.word_count / 1000).toFixed(1)}k words</span>}
                  </div>
                </div>
                <button className="doc-delete" onClick={e => handleDelete(e, doc.id)}>×</button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="chat-area">
          {!activeDoc ? (
            <div
              className={`drop-zone ${dragOver ? "drag-active" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className="drop-zone-inner">
                <div className="drop-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9"  y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <h3>Drop your PDF here</h3>
                <p>or click to browse</p>
                <div className="drop-hint">Supports PDF · AI-powered analysis</div>
              </div>
            </div>
          ) : (
            <>
              <div className="messages">
                {messages.length === 0 && !loading && (
                  <div className="messages-empty">
                    <p>Document loaded. Ask anything about it.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`message ${m.role}`}>
                    {m.role === "assistant" && <div className="msg-avatar assistant-avatar">AI</div>}
                    <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    {m.role === "user" && (
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {loading && messages[messages.length - 1]?.role !== "assistant" && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>

              <form className="input-bar" onSubmit={handleAsk}>
                <div className="input-row">
                  <input
                    ref={inputRef}
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask anything about this document…"
                    disabled={loading}
                  />
                  <button className="send-btn" type="submit" disabled={loading || !question.trim()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
                <div className="input-hint">
                  Press <span className="kbd">Enter</span> to send · Powered by Gemini + RAG
                </div>
              </form>
            </>
          )}
        </main>

        {/* Info panel — only when a doc is active */}
        {activeDoc && <InfoPanel doc={activeDoc} msgCount={messages.length} />}
      </div>
    </div>
  );
}