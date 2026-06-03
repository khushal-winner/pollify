"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export default function Home() {
  // User Session States
  const [user, setUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Polls States
  const [polls, setPolls] = useState<any[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(true);
  const [votingInProgress, setVotingInProgress] = useState<Record<string, boolean>>({});

  // Share / Deep-link States
  const [copiedPollId, setCopiedPollId] = useState<string | null>(null);
  const [highlightedPollId, setHighlightedPollId] = useState<string | null>(null);
  const pollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auth Modal States
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register" | "anonymous">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Create Poll Form States
  const [pollTitle, setPollTitle] = useState("");
  const [pollDesc, setPollDesc] = useState("");
  const [pollExpiresAt, setPollExpiresAt] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [pollSuccess, setPollSuccess] = useState(false);

  // Fetch current user session
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error("Fetch user failed:", err);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  // Fetch polls and options
  const fetchPolls = useCallback(async () => {
    try {
      const res = await fetch("/api/polls");
      if (res.ok) {
        const data = await res.json();
        setPolls(data.polls || []);
      }
    } catch (err) {
      console.error("Fetch polls failed:", err);
    } finally {
      setLoadingPolls(false);
    }
  }, []);

  // Initial load + deep-link detection
  useEffect(() => {
    fetchUser();
    fetchPolls();

    // Check for ?poll=<id> query param
    const params = new URLSearchParams(window.location.search);
    const targetPollId = params.get("poll");
    if (targetPollId) {
      setHighlightedPollId(targetPollId);
    }
  }, [fetchUser, fetchPolls]);

  // Scroll to highlighted poll once polls are loaded
  useEffect(() => {
    if (highlightedPollId && polls.length > 0) {
      const el = pollRefs.current[highlightedPollId];
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    }
  }, [highlightedPollId, polls]);

  // Polling fallback to keep results up to date (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPolls();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchPolls]);

  // Handle Authentication (Login/Register/Guest)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmittingAuth(true);

    let url = "/api/auth/login";
    let body: any = { email, password };

    if (authTab === "register") {
      url = "/api/auth/register";
      body.name = name;
    } else if (authTab === "anonymous") {
      url = "/api/auth/anonymous";
      body = {};
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: authTab === "anonymous" ? undefined : JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setUser(data.user);
      setIsAuthOpen(false);
      // Reset inputs
      setEmail("");
      setPassword("");
      setName("");
      // Refresh polls to fetch userVotedOptionId
      fetchPolls();
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      // Refresh polls to clear userVotedOptionId
      fetchPolls();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Manage Option input changes
  const handleOptionChange = (index: number, val: string) => {
    const newOpts = [...pollOptions];
    newOpts[index] = val;
    setPollOptions(newOpts);
  };

  const addOptionInput = () => {
    if (pollOptions.length < 10) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const removeOptionInput = (index: number) => {
    if (pollOptions.length > 2) {
      const newOpts = pollOptions.filter((_, i) => i !== index);
      setPollOptions(newOpts);
    }
  };

  // Handle Poll Creation
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setPollError(null);
    setPollSuccess(false);

    // Validate options
    const filteredOptions = pollOptions.map(o => o.trim()).filter(o => o !== "");
    if (!pollTitle.trim()) {
      setPollError("Poll title is required");
      return;
    }
    if (filteredOptions.length < 2) {
      setPollError("At least 2 non-empty options are required");
      return;
    }

    setCreatingPoll(true);

    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pollTitle.trim(),
          description: pollDesc.trim() || undefined,
          expiresAt: pollExpiresAt || undefined,
          options: filteredOptions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create poll");
      }

      setPollSuccess(true);
      setPollTitle("");
      setPollDesc("");
      setPollExpiresAt("");
      setPollOptions(["", ""]);
      fetchPolls();
    } catch (err: any) {
      setPollError(err.message);
    } finally {
      setCreatingPoll(false);
    }
  };

  // Handle Cast Vote
  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) {
      setAuthTab("anonymous");
      setIsAuthOpen(true);
      return;
    }

    if (votingInProgress[pollId]) return;
    setVotingInProgress(prev => ({ ...prev, [pollId]: true }));

    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Voting failed");
        return;
      }

      // Optimistically update local poll list state
      setPolls(prevPolls =>
        prevPolls.map(poll => {
          if (poll.$id !== pollId) return poll;
          return {
            ...poll,
            userVotedOptionId: optionId,
            options: poll.options.map((opt: any) => {
              if (opt.$id !== optionId) return opt;
              return { ...opt, votesCount: (opt.votesCount || 0) + 1 };
            }),
          };
        })
      );
    } catch (err) {
      console.error("Voting failed:", err);
    } finally {
      setVotingInProgress(prev => ({ ...prev, [pollId]: false }));
      fetchPolls(); // Refresh lists to sync fully
    }
  };

  // Handle Delete Poll
  const handleDeletePoll = async (pollId: string) => {
    if (!confirm("Are you sure you want to delete this poll? All options and votes will be permanently deleted.")) {
      return;
    }

    try {
      const res = await fetch(`/api/polls/${pollId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete poll");
        return;
      }

      setPolls(prev => prev.filter(p => p.$id !== pollId));
    } catch (err) {
      console.error("Deletion failed:", err);
    }
  };

  // Handle Share Poll
  const handleSharePoll = async (pollId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?poll=${pollId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedPollId(pollId);
    setTimeout(() => setCopiedPollId(null), 2500);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden p-6 md:p-12">
      {/* Decorative Glow Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[35rem] h-[35rem] rounded-full bg-teal-500/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[35rem] h-[35rem] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto z-10 relative flex flex-col gap-12">

        {/* Navigation Bar */}
        <header className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl text-teal-400">🗳️</span>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              Pollify
            </h1>
          </div>
          <div>
            {loadingUser ? (
              <div className="h-10 w-24 bg-white/5 animate-pulse rounded-lg"></div>
            ) : user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-slate-200">{user.name || "Anonymous Guest"}</p>
                  <p className="text-xs text-slate-400">
                    {user.email ? `👤 Registered` : `👻 Guest Mode`}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-xs font-semibold text-teal-200 border border-teal-500/30 hover:border-teal-400 hover:text-white rounded-lg bg-teal-500/5 transition duration-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthTab("login");
                  setIsAuthOpen(true);
                }}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 active:scale-95 shadow-lg shadow-teal-600/20 rounded-xl transition duration-150"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <section className="text-center py-12 flex flex-col gap-4">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-normal pb-2 bg-gradient-to-r from-teal-200 via-teal-400 to-cyan-200 bg-clip-text text-transparent">
            Instant Community Insights
          </h2>
          <p className="max-w-xl mx-auto text-sm md:text-base text-slate-300">
            Create beautiful polls, invite colleagues or neighbors to vote securely, and visualize results in real-time.
          </p>
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: Create Poll Form */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Create a New Poll</h3>
                <p className="text-xs text-slate-400 mt-1">Host a public poll and let anyone share their thoughts.</p>
              </div>

              {!user ? (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center flex flex-col gap-3">
                  <p className="text-xs text-slate-300">You must be logged in to create a poll.</p>
                  <button
                    onClick={() => {
                      setAuthTab("login");
                      setIsAuthOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition duration-150"
                  >
                    Authenticate Now
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreatePoll} className="flex flex-col gap-4">
                  {pollError && (
                    <div className="p-3 text-xs bg-red-950/40 border border-red-500/20 text-red-300 rounded-lg">
                      {pollError}
                    </div>
                  )}
                  {pollSuccess && (
                    <div className="p-3 text-xs bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 rounded-lg">
                      🎉 Poll published successfully!
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">Poll Title</label>
                    <input
                      type="text"
                      value={pollTitle}
                      onChange={(e) => setPollTitle(e.target.value)}
                      placeholder="e.g. Next project milestone framework?"
                      className="glass-input px-3.5 py-2.5 text-sm"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">Description (Optional)</label>
                    <textarea
                      value={pollDesc}
                      onChange={(e) => setPollDesc(e.target.value)}
                      placeholder="Provide additional details or context..."
                      className="glass-input px-3.5 py-2 text-sm min-h-[70px] resize-y"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">Expiration Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={pollExpiresAt}
                      onChange={(e) => setPollExpiresAt(e.target.value)}
                      className="glass-input px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-slate-400">Options</label>
                      {pollOptions.length < 10 && (
                        <button
                          type="button"
                          onClick={addOptionInput}
                          className="text-xs font-bold text-teal-400 hover:text-teal-300 transition duration-150"
                        >
                          + Add Option
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {pollOptions.map((opt, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Option #${index + 1}`}
                            className="glass-input px-3 py-2 text-xs flex-grow"
                            required
                          />
                          {pollOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOptionInput(index)}
                              className="p-2 text-slate-400 hover:text-red-400 transition"
                            >
                              ❌
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creatingPoll}
                    className="w-full mt-2 py-3 bg-teal-600 hover:bg-teal-500 active:scale-95 disabled:opacity-50 text-sm font-semibold rounded-xl text-white shadow-lg shadow-teal-600/10 transition duration-150"
                  >
                    {creatingPoll ? "Publishing..." : "Launch Poll"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Active Polls List */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Active Discussions</h3>
              <button
                onClick={fetchPolls}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium transition"
              >
                🔄 Refresh
              </button>
            </div>

            {loadingPolls ? (
              <div className="flex flex-col gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="glass-panel rounded-2xl p-6 h-56 animate-pulse"></div>
                ))}
              </div>
            ) : polls.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                <span className="text-4xl">📭</span>
                <p className="text-sm text-slate-400">No active polls found. Create one to start the conversation!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {polls.map((poll) => {
                  const hasVoted = !!poll.userVotedOptionId;
                  const isExpired = poll.expiresAt ? new Date(poll.expiresAt) < new Date() : false;
                  const totalVotes = poll.options.reduce((acc: number, o: any) => acc + (o.votesCount || 0), 0);
                  const isCreator = user && poll.creatorId === user.$id;

                  return (
                    <div
                      key={poll.$id}
                      ref={(el) => { pollRefs.current[poll.$id] = el; }}
                      className={`glass-panel rounded-2xl p-6 flex flex-col gap-5 glass-panel-hover transition-all duration-500 ${highlightedPollId === poll.$id
                        ? "ring-2 ring-teal-400/60 shadow-[0_0_32px_0_rgba(45,212,191,0.18)]"
                        : ""
                        }`}
                    >

                      {/* Poll Title & Metadata */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2 items-center flex-wrap">
                            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-teal-900/60 border border-teal-500/20 text-teal-300">
                              {isExpired ? "EXPIRED" : "ACTIVE"}
                            </span>
                            {poll.expiresAt && (
                              <span className="text-[10px] text-slate-400">
                                {isExpired
                                  ? "Ended"
                                  : `Expires: ${new Date(poll.expiresAt).toLocaleDateString()} ${new Date(poll.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-bold text-white leading-snug mt-1">{poll.title}</h4>
                          {poll.description && (
                            <p className="text-xs text-slate-300 whitespace-pre-line mt-1">{poll.description}</p>
                          )}
                        </div>

                        {/* Delete Button (Creator Only) */}
                        {isCreator && (
                          <button
                            onClick={() => handleDeletePoll(poll.$id)}
                            className="p-1.5 text-xs text-slate-400 hover:text-red-400 bg-white/5 rounded-lg border border-white/5 hover:border-red-500/20 transition"
                            title="Delete Poll"
                          >
                            🗑️
                          </button>
                        )}
                      </div>

                      {/* Options List */}
                      <div className="flex flex-col gap-3">
                        {poll.options.map((option: any) => {
                          const optionVotes = option.votesCount || 0;
                          const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                          const isUserSelection = poll.userVotedOptionId === option.$id;

                          // Render results mode (Voted or Expired)
                          if (hasVoted || isExpired) {
                            return (
                              <div key={option.$id} className="relative p-3.5 rounded-xl border border-white/5 bg-slate-900/20 overflow-hidden flex flex-col gap-1">
                                {/* Percentage fill background */}
                                <div
                                  className="absolute top-0 left-0 bottom-0 bg-teal-500/10 progress-fill"
                                  style={{ width: `${pct}%` }}
                                ></div>

                                <div className="flex justify-between items-center z-10 relative">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-white">{option.text}</span>
                                    {isUserSelection && (
                                      <span className="text-xs text-teal-400" title="Your Vote">
                                        ✓ Voted
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs font-bold text-teal-300">{pct}% ({optionVotes})</span>
                                </div>

                                <div className="w-full bg-white/5 rounded-full h-1 mt-1 overflow-hidden z-10 relative">
                                  <div
                                    className="bg-teal-500 h-full progress-fill rounded-full"
                                    style={{ width: `${pct}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          }

                          // Render interactive vote mode
                          return (
                            <button
                              key={option.$id}
                              onClick={() => handleVote(poll.$id, option.$id)}
                              disabled={votingInProgress[poll.$id]}
                              className="w-full p-3.5 rounded-xl border border-white/10 hover:border-teal-500/40 text-left bg-slate-900/30 hover:bg-teal-500/5 hover:text-white transition duration-200 text-xs font-semibold text-slate-200 flex justify-between items-center active:scale-[0.99] disabled:opacity-50"
                            >
                              <span>{option.text}</span>
                              <span className="text-[10px] text-teal-400 font-bold opacity-0 group-hover:opacity-100 transition">Vote →</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Vote Count Footer + Share */}
                      <div className="flex justify-between items-center border-t border-white/5 pt-3 text-[10px] text-slate-400">
                        <span>Total votes cast: {totalVotes}</span>
                        <button
                          onClick={() => handleSharePoll(poll.$id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-200 text-[10px] font-semibold ${copiedPollId === poll.$id
                            ? "bg-teal-500/20 border-teal-400/40 text-teal-300"
                            : "bg-white/5 border-white/10 hover:border-teal-400/30 hover:text-teal-300 text-slate-400"
                            }`}
                          title="Copy shareable link"
                        >
                          {copiedPollId === poll.$id ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
                              Link Copied!
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47A3 3 0 1015 12a3 3 0 00-.023-.396l-4.94-2.47A3 3 0 0015 8z" /></svg>
                              Share
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Auth Modal Overlay */}
      {isAuthOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 flex flex-col gap-6 animate-fade-in">

            {/* Modal Header */}
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Join Pollify</h3>
              <button
                onClick={() => setIsAuthOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => { setAuthTab("login"); setAuthError(null); }}
                className={`flex-grow pb-3 text-sm font-semibold transition ${authTab === "login" ? "text-teal-400 border-b-2 border-teal-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthTab("register"); setAuthError(null); }}
                className={`flex-grow pb-3 text-sm font-semibold transition ${authTab === "register" ? "text-teal-400 border-b-2 border-teal-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                Register
              </button>
              <button
                onClick={() => { setAuthTab("anonymous"); setAuthError(null); }}
                className={`flex-grow pb-3 text-sm font-semibold transition ${authTab === "anonymous" ? "text-teal-400 border-b-2 border-teal-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                Guest Login
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              {authError && (
                <div className="p-3 text-xs bg-red-950/40 border border-red-500/20 text-red-300 rounded-lg">
                  {authError}
                </div>
              )}

              {authTab === "anonymous" ? (
                <div className="flex flex-col gap-4 text-center py-4">
                  <p className="text-xs text-slate-300">
                    A guest session allows you to cast votes instantly without sharing email credentials or password data.
                  </p>
                  <p className="text-[10px] text-teal-400 italic">
                    Note: Guest sessions expire if inactive.
                  </p>
                </div>
              ) : (
                <>
                  {authTab === "register" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-semibold">Your Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="glass-input px-3.5 py-2.5 text-sm"
                        required
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. john@example.com"
                      className="glass-input px-3.5 py-2.5 text-sm"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="glass-input px-3.5 py-2.5 text-sm"
                      minLength={8}
                      required
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={submittingAuth}
                className="w-full mt-2 py-3 bg-teal-600 hover:bg-teal-500 active:scale-95 disabled:opacity-50 text-sm font-semibold rounded-xl text-white shadow-lg shadow-teal-600/10 transition duration-150"
              >
                {submittingAuth ? "Authenticating..." : authTab === "login" ? "Sign In" : authTab === "register" ? "Create Account" : "Access as Guest"}
              </button>
            </form>

          </div>
        </div>
      )}
    </main>
  );
}
