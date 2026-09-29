import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import AuthPage from "./AuthPage";
import {
  uploadPDF, summarize, ask,
  listDocuments, getConversations, deleteDocument,
} from "./api";
import "./App.css";

interface User { name: string; email: string; }
interface Doc {
  id: string; filename: string;
  pages?: number; word_count?: number; read_time?: number;
  created_at: string;
}
interface Message { role: "user" | "assistant"; content: string; }

function Avatar({ name }: { name: string }) {
  return (
    <div className="avatar">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

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

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    return t && u ? JSON.parse(u) : null;
  });

  const [documents, setDocuments] = useState<Doc[]>([]);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setMessages(convs.map((c: any) => ({ role: c.role, content: c.content })));
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
    e.preventDefault();
    setDragOver(false);
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
      const res = await ask(activeDoc.id, q);
      setMessages(prev => [...prev, { role: "assistant", content: res.answer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
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

  function handleAuth(_token: string, u: User) {
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  }

  if (!user) return <AuthPage onAuth={handleAuth} />;

  return (
    <div className="app">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-icon">⬡</span>
          <span className="brand-name">DocuMind</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-doc-count">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </div>
          <div className="user-pill">
            <Avatar name={user.name} />
            <span className="user-name">{user.name}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <button
              className="upload-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><span className="spin">↻</span> Uploading...</>
              ) : (
                <><span>+</span> Upload PDF</>
              )}
            </button>
            <input ref={fileRef} type="file" accept=".pdf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) processUpload(f); }} />
          </div>

          <div className="sidebar-label">RECENT DOCUMENTS</div>

          <div className="doc-list">
            {documents.length === 0 ? (
              <div className="doc-empty">
                <div className="doc-empty-icon">📄</div>
                <p>No documents yet</p>
                <p>Upload a PDF to get started</p>
              </div>
            ) : (
              documents.map(doc => (
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
                      {doc.read_time && <span>{doc.read_time} min</span>}
                    </div>
                  </div>
                  <button className="doc-delete" onClick={e => handleDelete(e, doc.id)}>
                    ×
                  </button>
                </div>
              ))
            )}
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
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <h3>Drop your PDF here</h3>
                <p>or click to browse files</p>
                <div className="drop-hint">Supports PDF • AI-powered analysis</div>
              </div>
            </div>
          ) : (
            <>
              <div className="chat-topbar">
                <div className="chat-doc-info">
                  <span className="chat-doc-badge">PDF</span>
                  <span className="chat-doc-name">{activeDoc.filename}</span>
                </div>
                <div className="chat-doc-meta">
                  {activeDoc.pages && <span>{activeDoc.pages} pages</span>}
                  {activeDoc.word_count && <span>{activeDoc.word_count.toLocaleString()} words</span>}
                  {activeDoc.read_time && <span>{activeDoc.read_time} min read</span>}
                </div>
              </div>

              <div className="messages">
                {messages.length === 0 && !loading && (
                  <div className="messages-empty">
                    <p>Document loaded. Ask me anything about it.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`message ${m.role}`}>
                    {m.role === "assistant" && <div className="msg-avatar assistant-avatar">AI</div>}
                    <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    {m.role === "user" && <Avatar name={user.name} />}
                  </div>
                ))}
                {loading && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>

              <form className="input-bar" onSubmit={handleAsk}>
                <input
                  ref={inputRef}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Ask anything about this document..."
                  disabled={loading}
                />
                <button type="submit" disabled={loading || !question.trim()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}