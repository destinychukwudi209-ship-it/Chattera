
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  LogOut, Send, MessageCircle, LoaderCircle,
  Wifi, UserRound
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseReady } from "./supabase";

type ChatMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [text, setText] = useState("");
  const [register, setRegister] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUser(data.session?.user ?? null);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !supabaseReady) {
      setMessages([]);
      return;
    }

    let active = true;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("id,user_id,content,created_at")
        .order("created_at", { ascending: true })
        .limit(200);

      if (!active) return;
      if (error) setError(error.message);
      else setMessages((data ?? []) as ChatMessage[]);
    }

    loadMessages();

    const channel = supabase
      .channel("chattera-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages"
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function authenticate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = register
        ? await supabase.auth.signUp({
            email: email.trim(),
            password
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
          });

      if (result.error) throw result.error;

      if (
        register &&
        !result.data.session &&
        result.data.user
      ) {
        setError("Account created. Check your email to confirm, then sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!user || !text.trim() || sending) return;

    setSending(true);
    setError("");

    const content = text.trim();

    const { error } = await supabase.from("messages").insert({
      user_id: user.id,
      content
    });

    if (error) {
      setError(error.message);
    } else {
      setText("");
    }

    setSending(false);
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  }

  if (loading) {
    return (
      <main className="center-screen">
        <LoaderCircle className="spin" size={32} />
        <p>Opening Chattera...</p>
      </main>
    );
  }

  if (!supabaseReady) {
    return (
      <main className="center-screen">
        <div className="brand-icon">
          <MessageCircle size={38} />
        </div>
        <h1>Chattera</h1>
        <p className="muted">
          Your new messaging app starts here.
        </p>
        <div className="notice">
          <strong>Supabase setup needed</strong>
          <p>
            Add VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY to your environment
            variables, then restart the app.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="center-screen">
        <section className="auth-card">
          <div className="brand-icon">
            <MessageCircle size={38} />
          </div>
          <h1>Chattera</h1>
          <p className="muted">
            Every conversation brings us closer.
          </p>

          <form onSubmit={authenticate}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              autoComplete={register ? "new-password" : "current-password"}
              required
            />

            {error && <p className="error">{error}</p>}

            <button className="primary-button" disabled={loading}>
              {register ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "Already registered? Sign in"
              : "New to Chattera? Create an account"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-icon small">
          <MessageCircle size={25} />
        </div>
        <div className="brand-title">
          <h1>Chattera</h1>
          <span><Wifi size={13} /> Connected account</span>
        </div>
        <button
          className="icon-button"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={20} />
        </button>
      </header>

      <section className="chat-heading">
        <div className="avatar">
          <UserRound size={23} />
        </div>
        <div>
          <strong>Community chat</strong>
          <p>Signed in as {user.email}</p>
        </div>
      </section>

      <section className="messages" aria-label="Messages">
        <p className="date-label">YOUR CONVERSATION</p>

        {messages.length === 0 && (
          <div className="empty-state">
            <MessageCircle size={38} />
            <strong>Say hello!</strong>
            <p>Your first message starts the conversation.</p>
          </div>
        )}

        {messages.map(message => {
          const mine = message.user_id === user.id;
          return (
            <article
              key={message.id}
              className={`message ${mine ? "mine" : "theirs"}`}
            >
              {!mine && (
                <span className="sender">
                  {message.user_id.slice(0, 8)}
                </span>
              )}
              <p>{message.content}</p>
              <time>
                {new Date(message.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </time>
            </article>
          );
        })}
        <div ref={bottom} />
      </section>

      {error && <p className="error inline-error">{error}</p>}

      <form className="composer" onSubmit={sendMessage}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write a message..."
          aria-label="Message"
          maxLength={4000}
        />
        <button
          className="send-button"
          disabled={!text.trim() || sending}
          aria-label="Send message"
        >
          {sending
            ? <LoaderCircle className="spin" size={20} />
            : <Send size={20} />}
        </button>
      </form>
      <footer>Messages are shared with authenticated chat users.</footer>
    </main>
  );
    }
              
