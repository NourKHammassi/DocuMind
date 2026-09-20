import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API = "http://127.0.0.1:8000";

interface Message { role: "user" | "assistant"; content: string; }
interface DocMeta { name: string; pages: number; words: number; readTime: number; }

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    setStatus("Reading PDF...");
    setMessages([]);
    setSessionId(null);
    setMeta(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API}/upload`, formData);
      const { session_id, pages, word_count, read_time } = res.data;
      setSessionId(session_id);
      setMeta({ name: file.name, pages, words: word_count, readTime: read_time });
      setStatus("Generating summary...");
      const summary = await axios.post(`${API}/summarize`, { session_id });
      setMessages([{ role: "assistant", content: summary.data.summary }]);
      setStatus("");
    } catch {
      setStatus("Failed to process document.");
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!input.trim() || !sessionId || loading) return;
    const question = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setMessages(p => [...p, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ask`, { session_id: sessionId, question });
      setMessages(p => [...p, { role: "assistant", content: res.data.answer }]);
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "Something went wrong." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); }
  };

  const handleClear = () => {
    setMessages([]); setSessionId(null); setMeta(null);
    setStatus(""); setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="app">
      {/* TOPBAR */}
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo-mark" />
          <span className="logo">DocuMind</span>
          {status && (
            <div className="status-pill">
              <span className="spinner" />
              {status}
            </div>
          )}
        </div>
        <div className="topbar-right">
          {meta && (
            <div className="meta-pills">
              <span className="pill">{meta.pages}p</span>
              <span className="pill">{meta.words > 999 ? `${(meta.words/1000).toFixed(1)}k` : meta.words}w</span>
              <span className="pill">{meta.readTime}m read</span>
              <span className="pill">{messages.length} msgs</span>
            </div>
          )}
          <button className="theme-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
            {theme === "dark" ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <div className="body">
        {/* PDF PREVIEW PANEL */}
        <div className="preview-panel">
          <input ref={fileRef} type="file" accept=".pdf" onChange={handleUpload} style={{ display: "none" }} />

          {!previewUrl ? (
            <div className="upload-zone" onClick={() => fileRef.current?.click()}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span className="upload-title">Upload PDF</span>
              <span className="upload-sub">Click or drop a file here</span>
            </div>
          ) : (
            <div className="preview-wrap">
              <div className="preview-toolbar">
                <span className="preview-filename">{meta?.name}</span>
                <div className="preview-actions">
                  <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Upload new">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </button>
                  <button className="icon-btn" onClick={handleClear} title="Clear">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
              <iframe src={previewUrl} className="pdf-iframe" title="PDF Preview" />
            </div>
          )}
        </div>

        {/* CHAT PANEL */}
        <div className="chat-panel">
          {!sessionId && !loading && (
            <div className="empty-state">
              <p className="empty-title">No document loaded</p>
              <p className="empty-sub">Upload a PDF on the left to get started.</p>
            </div>
          )}

          <div className="messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <span className="msg-author">{msg.role === "user" ? "You" : "DocuMind"}</span>
                <div className="msg-bubble">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && messages.length > 0 && (
              <div className="message assistant">
                <span className="msg-author">DocuMind</span>
                <div className="msg-bubble thinking"><span/><span/><span/></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {sessionId && (
            <div className="input-row">
              <div className="input-wrap">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); autoResize(); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about the document..."
                  disabled={loading}
                  rows={1}
                />
                <button className="send-btn" onClick={handleAsk} disabled={loading || !input.trim()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
              <p className="input-hint">Enter to send · Shift+Enter for new line</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}