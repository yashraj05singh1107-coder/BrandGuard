"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Section = "Overview" | "Content Review" | "Brand Guidelines" | "Review History" | "Settings";
type Severity = "High" | "Medium" | "Low";
type FindingStatus = "Pending" | "Accepted" | "Edited" | "Dismissed";

type Finding = {
  id: string;
  ruleId: string;
  category: string;
  severity: Severity;
  matchedText: string;
  reason: string;
  source: string;
  suggestion: string;
  replacement: string;
  start: number;
  end: number;
  status: FindingStatus;
};

type DemoReview = {
  title: string;
  date: string;
  status: string;
  issues: number;
  channel: string;
};

type ApiReview = {
  reviewId: string;
  text: string;
  findings: Finding[];
};

type ReviewHistoryItem = {
  reviewId: string;
  title: string;
  text: string;
  issues: number;
  pending: number;
  status: "In review" | "Reviewed";
  createdAt: string;
  updatedAt: string;
};

type BrandRule = {
  id: string;
  category: string;
  severity: Severity;
  terms: string[];
  reason: string;
  source: string;
  suggestion: string;
};

type BrandRulesResponse = {
  brandName: string;
  description: string;
  approvedFacts: string[];
  requiredDisclaimer: string;
  rules: BrandRule[];
  heuristics: BrandRule[];
  disclaimerRule: BrandRule;
};

type DecisionResponse = {
  reviewId: string;
  findingId: string;
  status: FindingStatus;
  replacement: string | null;
  text: string;
};

type ApiStatus = "checking" | "connected" | "unavailable";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

const sampleCopy =
  "Our revolutionary workspace helps every customer succeed with guaranteed results. Join thousands of teams working smarter.";

const demoReviews: DemoReview[] = [
  { title: "Spring launch email", date: "Today, 10:42 AM", status: "In review", issues: 4, channel: "Email" },
  { title: "Product page refresh", date: "Today, 9:18 AM", status: "Approved", issues: 0, channel: "Website" },
  { title: "Social campaign — April", date: "Yesterday, 4:06 PM", status: "In review", issues: 2, channel: "Social" },
  { title: "Workspace overview", date: "Yesterday, 11:30 AM", status: "Approved", issues: 1, channel: "Website" },
];

const navItems: { label: Section; icon: string }[] = [
  { label: "Overview", icon: "grid" },
  { label: "Content Review", icon: "scan" },
  { label: "Brand Guidelines", icon: "book" },
  { label: "Review History", icon: "clock" },
  { label: "Settings", icon: "settings" },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10M12 7v10" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H20M8 7h8M8 10h6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.1.9-1 1.8-1.4-.5a8 8 0 0 1-1.6.9l-.2 1.5h-2.1l-.3-1.5a8 8 0 0 1-1.7-.7l-1.3.6-1.2-1.8 1.1-1a7 7 0 0 1-.2-1.8l-1.2-.8.8-2 1.5.2a8 8 0 0 1 1.3-1.3l-.1-1.5 2-.7.8 1.3a8 8 0 0 1 1.8.2l1-1.1 1.8 1.2-.6 1.4a8 8 0 0 1 .7 1.7l1.5.3v2.1l-1.5.2a8 8 0 0 1-.7 1.6Z" transform="translate(-1 -1) scale(.96)" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" /><path d="m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1z" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    clockSmall: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    sliders: <><path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4" /></>,
    help: <><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] ?? paths.grid}
    </svg>
  );
}

async function getApiError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((item) => typeof item === "object" && item !== null && "msg" in item ? String(item.msg) : "")
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    return `The API request failed (${response.status}).`;
  }
  return `The API request failed (${response.status}).`;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await getApiError(response));
  return response.json() as Promise<T>;
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`severity severity-${severity.toLocaleLowerCase()}`}><span />{severity}</span>;
}

function StatCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: ReactNode; icon: string; tone: string }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon name={icon} size={19} /></div>
      <p className="stat-label">{label}</p>
      <div className="stat-value">{value}</div>
      <p className="stat-detail">{detail}</p>
    </article>
  );
}

export default function Home() {
  const [section, setSection] = useState<Section>("Overview");
  const [draft, setDraft] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, FindingStatus>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [decisionInProgress, setDecisionInProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"All" | Severity>("All");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [rules, setRules] = useState<BrandRulesResponse | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState("");
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [refreshData, setRefreshData] = useState(0);

  function navigateTo(nextSection: Section) {
    setSection(nextSection);
    setNotice("");
    if (nextSection === "Brand Guidelines") {
      setRulesLoading(true);
      setRulesError("");
    }
    if (nextSection === "Review History") {
      setHistoryLoading(true);
      setHistoryError("");
    }
  }

  const visibleFindings = useMemo(
    () => findings.filter((finding) => filter === "All" || finding.severity === filter),
    [findings, filter],
  );

  useEffect(() => {
    let active = true;
    apiRequest<{ status: string }>("/api/health")
      .then(() => {
        if (active) setApiStatus("connected");
      })
      .catch(() => {
        if (active) setApiStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (section !== "Brand Guidelines") return;
    let active = true;
    apiRequest<BrandRulesResponse>("/api/rules")
      .then((response) => {
        if (active) {
          setRules(response);
          setApiStatus("connected");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRulesError(error instanceof Error ? error.message : "Could not load brand rules.");
          setApiStatus("unavailable");
        }
      })
      .finally(() => {
        if (active) setRulesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [section, refreshData]);

  useEffect(() => {
    if (section !== "Review History") return;
    let active = true;
    apiRequest<ReviewHistoryItem[]>("/api/reviews")
      .then((response) => {
        if (active) {
          setHistory(response);
          setApiStatus("connected");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setHistoryError(error instanceof Error ? error.message : "Could not load review history.");
          setApiStatus("unavailable");
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [section, refreshData]);

  async function runReview() {
    if (!draft.trim()) {
      setNotice("Add some marketing copy before starting a review.");
      return;
    }

    setReviewing(true);
    setNotice("");
    try {
      const response = await apiRequest<ApiReview>("/api/review", {
        method: "POST",
        body: JSON.stringify({ text: draft }),
      });
      setReviewId(response.reviewId);
      setDraft(response.text);
      setFindings(response.findings);
      setStatuses(Object.fromEntries(response.findings.map((finding) => [finding.id, finding.status])));
      setEdits({});
      setEditing(null);
      setReviewed(true);
      setApiStatus("connected");
      setNotice("Review complete. Findings were checked against the configured Python brand rules.");
    } catch (error) {
      setReviewed(false);
      setApiStatus("unavailable");
      setNotice(error instanceof Error ? error.message : "Could not complete the content review.");
    } finally {
      setReviewing(false);
    }
  }

  async function decideFinding(
    finding: Finding,
    action: "accept" | "edit" | "dismiss",
    replacement?: string,
  ) {
    if (!reviewId) {
      setNotice("Run a new review before making a decision.");
      return;
    }
    if (action === "edit" && !replacement?.trim()) {
      setNotice("Enter replacement text before applying your edit.");
      return;
    }

    setDecisionInProgress(finding.id);
    setNotice("");
    try {
      const response = await apiRequest<DecisionResponse>(
        `/api/reviews/${encodeURIComponent(reviewId)}/findings/${encodeURIComponent(finding.id)}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            ...(action === "edit" ? { replacement: replacement?.trim() } : {}),
          }),
        },
      );
      setDraft(response.text);
      setStatuses((current) => ({ ...current, [finding.id]: response.status }));
      setEditing(null);
      setApiStatus("connected");
      const changedDraft = response.text !== draft;
      setFindings((current) => current.map((item) =>
        item.id === finding.id && response.replacement !== null
          ? { ...item, replacement: response.replacement }
          : item,
      ));
      setNotice(
        action === "dismiss"
          ? "Finding dismissed. The draft was not changed."
          : changedDraft
            ? `${response.status} and applied to the draft.`
            : `${response.status}. No literal replacement was configured, so the draft was not changed.`,
      );
      setRefreshData((current) => current + 1);
    } catch (error) {
      setApiStatus("unavailable");
      setNotice(error instanceof Error ? error.message : "Could not save this review decision.");
    } finally {
      setDecisionInProgress(null);
    }
  }

  const pendingCount = findings.filter((finding) => !statuses[finding.id] || statuses[finding.id] === "Pending").length;
  const pageTitle = section === "Overview" ? "Overview" : section;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="#" onClick={(event) => { event.preventDefault(); navigateTo("Overview"); }} aria-label="BrandGuard home">
          <span className="brand-mark"><Icon name="shield" size={21} /></span>
          <span className="brand-name">brandguard<span>.</span></span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-avatar">N</span>
          <span className="workspace-copy"><strong>Northstar Workspace</strong><small>Demo brand</small></span>
          <span className="workspace-menu"><Icon name="chevron" size={15} /></span>
        </div>

        <p className="sidebar-label">WORKSPACE</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.label} className={`nav-item ${section === item.label ? "active" : ""}`} onClick={() => navigateTo(item.label)}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.label === "Content Review" && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="demo-notice"><span className="demo-dot" /><span><strong>Demo mode</strong><small>Sample data only</small></span></div>
          <button className="help-link" onClick={() => setNotice(`API status: ${apiStatus}. Reviews and rules use the local FastAPI service at ${API_BASE_URL}.`)}><Icon name="help" size={17} />Help &amp; feedback</button>
          <div className="profile">
            <span className="profile-avatar">JD</span>
            <span className="profile-copy"><strong>Jordan Davis</strong><small>Brand manager</small></span>
            <Icon name="chevron" size={15} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Northstar Workspace</span><Icon name="chevron" size={14} /><strong>{pageTitle}</strong></div>
          <div className="topbar-actions"><span className={`api-status ${apiStatus}`}><span />{apiStatus === "checking" ? "CONNECTING" : apiStatus === "connected" ? "API CONNECTED" : "API OFFLINE"}</span><span className="demo-pill"><span />DEMO DATA</span><button className="icon-button" aria-label="Settings" onClick={() => navigateTo("Settings")}><Icon name="settings" /></button><span className="top-avatar">JD</span></div>
        </header>

        <div className="page-content">
          {notice && <div className="notice-banner" role="status"><Icon name="spark" size={17} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}><Icon name="close" size={15} /></button></div>}

          {section === "Overview" && (
            <>
              <section className="welcome-row">
                <div><p className="eyebrow">MONDAY, APRIL 14, 2025</p><h1>Good morning, Jordan <span>✦</span></h1><p className="page-subtitle">Here’s how your brand content is looking.</p></div>
                <button className="primary-button" onClick={() => navigateTo("Content Review")}><Icon name="plus" size={18} />New content review</button>
              </section>

              <section className="stats-grid" aria-label="Demo dashboard metrics">
                <StatCard label="Total reviews" value="128" detail={<><span className="trend-up">↑ 12%</span> vs. last month</>} icon="file" tone="blue" />
                <StatCard label="Issues found" value="246" detail="Across all demo reviews" icon="scan" tone="amber" />
                <StatCard label="Approved content" value="86" detail={<><span className="trend-up">↑ 8%</span> vs. last month</>} icon="check" tone="green" />
                <StatCard label="Pending reviews" value="18" detail="Needs a human review" icon="clockSmall" tone="purple" />
              </section>

              <section className="dashboard-grid">
                <article className="panel recent-panel">
                  <div className="panel-heading"><div><h2>Recent reviews</h2><p>Your latest content activity</p></div><button className="text-button" onClick={() => navigateTo("Review History")}>View history <Icon name="arrow" size={15} /></button></div>
                  <div className="review-table-wrap"><table className="review-table"><thead><tr><th>CONTENT</th><th>CHANNEL</th><th>ISSUES</th><th>STATUS</th><th /></tr></thead><tbody>
                    {demoReviews.slice(0, 3).map((review) => <tr key={review.title}><td><strong>{review.title}</strong><small>{review.date}</small></td><td>{review.channel}</td><td><span className={review.issues ? "issue-count" : "no-issues"}>{review.issues || "—"}</span></td><td><span className={`review-status ${review.status === "Approved" ? "approved" : "in-review"}`}><span />{review.status}</span></td><td><button className="table-arrow" aria-label={`Open ${review.title}`} onClick={() => navigateTo("Content Review")}><Icon name="chevron" size={16} /></button></td></tr>)}
                  </tbody></table></div>
                  <button className="mobile-history-link" onClick={() => navigateTo("Review History")}>View all reviews <Icon name="arrow" size={15} /></button>
                </article>

                <article className="panel activity-panel">
                  <div className="panel-heading"><div><h2>Brand health</h2><p>Demo workspace · this month</p></div><span className="health-icon"><Icon name="shield" size={19} /></span></div>
                  <div className="health-score"><strong>92</strong><span>/100</span><span className="health-change">+4.2%</span></div>
                  <p className="health-caption">Your content is staying consistent with your brand guidelines.</p>
                  <div className="health-bar"><span /></div>
                  <div className="health-legend"><span>Brand consistency</span><strong>Excellent</strong></div>
                  <div className="activity-divider" />
                  <div className="activity-row"><span className="activity-symbol"><Icon name="check" size={15} /></span><span><strong>12 reviews approved</strong><small>in the last 7 days</small></span><Icon name="arrow" size={15} /></div>
                </article>
              </section>

              <section className="tip-banner"><span className="tip-icon"><Icon name="spark" size={19} /></span><div><strong>Keep your brand voice consistent</strong><p>Start a review to check copy against Northstar Workspace’s sample guidelines.</p></div><button onClick={() => navigateTo("Content Review")}>Review content <Icon name="arrow" size={15} /></button></section>
            </>
          )}

          {section === "Content Review" && (
            <>
              <section className="welcome-row review-welcome"><div><p className="eyebrow">CONTENT GOVERNANCE</p><h1>Content review</h1><p className="page-subtitle">Check your copy against Northstar Workspace’s configured brand guidelines.</p></div><span className={`api-status larger ${apiStatus}`}><span />{apiStatus === "checking" ? "CONNECTING" : apiStatus === "connected" ? "API CONNECTED" : "API OFFLINE"}</span></section>

              <section className="review-workspace">
                <article className="panel composer-panel">
                  <div className="panel-heading"><div><h2>Review your content</h2><p>Paste or write copy to check for brand alignment.</p></div><span className="composer-icon"><Icon name="file" size={19} /></span></div>
                  <label className="field-label" htmlFor="copy-input">MARKETING COPY</label>
                  <textarea id="copy-input" value={draft} onChange={(event) => { setDraft(event.target.value); setReviewed(false); setReviewId(null); }} placeholder="Paste your marketing copy here…" maxLength={10000} disabled={reviewing || decisionInProgress !== null} />
                  <div className="composer-meta"><span>{draft.length.toLocaleString()} / 10,000 characters</span><button className="sample-link" onClick={() => { setDraft(sampleCopy); setReviewed(false); setReviewId(null); }} disabled={reviewing || decisionInProgress !== null}>Load sample copy</button></div>
                  <div className="composer-footer"><span><Icon name="shield" size={16} />Checked by the Python brand-rules API</span><button className="primary-button" onClick={runReview} disabled={reviewing || decisionInProgress !== null || !draft.trim()}>{reviewing ? "Reviewing…" : <><Icon name="scan" size={17} />Review content</>}</button></div>
                  <p className="disclaimer-note">Marketing copy is sent to the configured API. Reviews and decisions are held in server memory and are cleared when the API restarts.</p>
                </article>
                <aside className="panel review-sidebar-card"><div className="review-aside-icon"><Icon name="book" size={19} /></div><h3>What we check</h3><p>Content is compared with the rules served by the Python API.</p><div className="check-list"><span><Icon name="check" size={15} />Configured terminology</span><span><Icon name="check" size={15} />Potential unsupported claims</span><span><Icon name="check" size={15} />Required disclaimers</span></div><button className="aside-link" onClick={() => navigateTo("Brand Guidelines")}>View brand guidelines <Icon name="arrow" size={15} /></button></aside>
              </section>

              {reviewed && (
                <section className="findings-section" aria-live="polite">
                  <div className="findings-heading"><div><p className="eyebrow">REVIEW RESULTS</p><h2>{findings.length ? `${findings.length} ${findings.length === 1 ? "finding" : "findings"} to review` : "Looking good!"}</h2><p>{findings.length ? "Review each suggestion before using it. You’re always in control." : "No configured rule matches were detected in this draft."}</p></div><label className="filter-control">Filter <select value={filter} onChange={(event) => setFilter(event.target.value as "All" | Severity)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></label></div>
                  {!findings.length ? <div className="panel empty-results"><span><Icon name="check" size={21} /></span><h3>No configured issues found</h3><p>Only configured Python rules were checked. This is not a guarantee that the copy is accurate or ready to publish.</p></div> : <div className="findings-list">{visibleFindings.map((finding) => {
                    const status = statuses[finding.id] ?? "Pending";
                    return <article className={`panel finding-card ${status !== "Pending" ? "finding-resolved" : ""}`} key={finding.id}>
                      <div className="finding-topline"><span className={`category-tag ${finding.severity.toLocaleLowerCase()}`}>{finding.category}</span><SeverityBadge severity={finding.severity} /><span className={`finding-status ${status.toLocaleLowerCase().replace(" ", "-")}`}>{status}</span></div>
                      <div className="finding-text-row"><div className="finding-copy"><span className="field-label">FLAGGED TEXT</span><p className={finding.matchedText ? "highlighted-quote" : "missing-quote"}>{finding.matchedText ? `“${finding.matchedText}”` : "Required disclaimer is missing"}</p><p className="finding-explanation">{finding.reason}</p></div><div className="rule-source"><span className="field-label">BRAND RULE</span><strong>{finding.source}</strong><span>{finding.ruleId}</span></div></div>
                      <div className="suggestion-box"><span className="suggestion-icon"><Icon name="spark" size={15} /></span><div><span className="field-label">SUGGESTED CORRECTION</span><p>{finding.suggestion}</p>{editing === finding.id && <label className="edit-field"><span className="sr-only">Replacement text</span><input value={edits[finding.id] ?? finding.replacement} onChange={(event) => setEdits((current) => ({ ...current, [finding.id]: event.target.value }))} placeholder="Enter your replacement wording" autoFocus /></label>}</div></div>
                      <div className="finding-actions">{status === "Pending" ? editing === finding.id ? <><button className="secondary-button" onClick={() => setEditing(null)} disabled={decisionInProgress === finding.id}>Cancel</button><button className="primary-button" onClick={() => decideFinding(finding, "edit", edits[finding.id] ?? finding.replacement)} disabled={decisionInProgress === finding.id || !(edits[finding.id] ?? finding.replacement).trim()}>{decisionInProgress === finding.id ? "Saving…" : <><Icon name="check" size={16} />Apply edit</>}</button></> : <><button className="secondary-button" onClick={() => decideFinding(finding, "accept")} disabled={decisionInProgress === finding.id}>{decisionInProgress === finding.id ? "Saving…" : <><Icon name="check" size={16} />Accept suggestion</>}</button><button className="secondary-button" onClick={() => { setEdits((current) => ({ ...current, [finding.id]: finding.replacement })); setEditing(finding.id); }} disabled={decisionInProgress === finding.id}><Icon name="edit" size={15} />Edit</button><button className="dismiss-button" onClick={() => decideFinding(finding, "dismiss")} disabled={decisionInProgress === finding.id}><Icon name="close" size={15} />Dismiss</button></> : <span className="resolution-note"><Icon name={status === "Dismissed" ? "close" : "check"} size={15} />{status === "Dismissed" ? "Dismissed — draft unchanged" : `${status} — ${finding.replacement ? "draft updated" : "draft unchanged"}`}</span>}</div>
                    </article>;
                  })}</div>}
                </section>
              )}
            </>
          )}

          {section === "Brand Guidelines" && (
            <section className="secondary-page">
              <div className="welcome-row">
                <div><p className="eyebrow">NORTHSTAR WORKSPACE</p><h1>Brand guidelines</h1><p className="page-subtitle">Rules and approved facts served by the Python API.</p></div>
                <span className={`api-status larger ${apiStatus}`}><span />{apiStatus === "connected" ? "LIVE RULES" : apiStatus === "checking" ? "CONNECTING" : "API OFFLINE"}</span>
              </div>
              {rulesLoading && <div className="panel guideline-intro" role="status">Loading brand rules from the API…</div>}
              {rulesError && <div className="notice-banner" role="alert"><span>{rulesError}</span><button className="secondary-button" onClick={() => { setRulesLoading(true); setRulesError(""); setRefreshData((current) => current + 1); }}>Retry</button></div>}
              {rules && <>
                <div className="panel guideline-intro"><span className="guideline-brand-icon">N</span><div><span className="field-label">DEMO BRAND</span><h2>{rules.brandName}</h2><p>{rules.description} Only configured checks are evaluated; a clean result does not mean every claim is verified.</p></div></div>
                <div className="guidelines-heading"><h2>Configured rules <span>{rules.rules.length + rules.heuristics.length + 1}</span></h2><p>Rules and claim-review guidance provided by the API.</p></div>
                <div className="guideline-list">{[...rules.rules, ...rules.heuristics, rules.disclaimerRule].map((rule) => <article className="panel guideline-card" key={rule.id}><span className="rule-id">{rule.id}</span><div><div className="guideline-title"><h3>{rule.category}</h3><SeverityBadge severity={rule.severity} /></div><p>{rule.reason}</p><span className="rule-examples">{rule.terms.filter(Boolean).join(", ")}</span><span className="rule-examples">{rule.source}</span></div><Icon name="chevron" size={18} /></article>)}</div>
                <article className="panel approved-facts"><span className="field-label">APPROVED DEMO FACTS</span><ul>{rules.approvedFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul><p className="rule-examples">Required disclaimer: {rules.requiredDisclaimer}</p></article>
              </>}
            </section>
          )}

          {section === "Review History" && (
            <section className="secondary-page">
              <div className="welcome-row"><div><p className="eyebrow">WORKSPACE ACTIVITY</p><h1>Review history</h1><p className="page-subtitle">Reviews currently held in the API’s memory.</p></div><span className={`api-status larger ${apiStatus}`}><span />{apiStatus === "connected" ? "LIVE HISTORY" : apiStatus === "checking" ? "CONNECTING" : "API OFFLINE"}</span></div>
              {historyLoading && <div className="panel guideline-intro" role="status">Loading review history…</div>}
              {historyError && <div className="notice-banner" role="alert"><span>{historyError}</span><button className="secondary-button" onClick={() => { setHistoryLoading(true); setHistoryError(""); setRefreshData((current) => current + 1); }}>Retry</button></div>}
              {!historyLoading && !historyError && <article className="panel history-panel"><div className="panel-heading"><div><h2>Recent content reviews</h2><p>Review and decision data is held in server memory.</p></div><span className="history-count">{history.length} reviews</span></div>{history.length ? <div className="review-table-wrap"><table className="review-table history-table"><thead><tr><th>CONTENT</th><th>ISSUES FOUND</th><th>PENDING</th><th>STATUS</th><th>LAST UPDATED (UTC)</th></tr></thead><tbody>{history.map((review) => <tr key={review.reviewId}><td><strong title={review.text}>{review.title}</strong></td><td><span className={review.issues ? "issue-count" : "no-issues"}>{review.issues || "—"}</span></td><td>{review.pending || "—"}</td><td><span className={`review-status ${review.status === "Reviewed" ? "approved" : "in-review"}`}><span />{review.status}</span></td><td>{review.updatedAt.replace("T", " ").replace(/\.\d+(\+00:00|Z)$/, " UTC").replace("+00:00", " UTC")}</td></tr>)}</tbody></table></div> : <div className="empty-results"><span><Icon name="clock" size={19} /></span><h3>No reviews yet</h3><p>Submit content on the Content Review screen to create the first review.</p></div>}</article>}
              <div className="history-feedback"><div><span className="feedback-icon"><Icon name="spark" size={19} /></span><div><strong>Suggestion feedback</strong><p>Accept, edit, and dismiss decisions are sent to the API. They remain in memory and are cleared when the backend restarts.</p></div></div><button className="secondary-button" onClick={() => navigateTo("Content Review")}>Try a review <Icon name="arrow" size={15} /></button></div>
            </section>
          )}

          {section === "Settings" && (
            <section className="secondary-page"><div className="welcome-row"><div><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="page-subtitle">Workspace configuration and connection status.</p></div><span className={`api-status larger ${apiStatus}`}><span />{apiStatus === "checking" ? "CONNECTING" : apiStatus === "connected" ? "API CONNECTED" : "API OFFLINE"}</span></div><article className="panel settings-card"><div className="settings-title"><span className="settings-icon"><Icon name="sliders" size={19} /></span><div><h2>Workspace settings</h2><p>Northstar Workspace · fictional demo brand</p></div></div><div className="settings-row"><div><strong>Review engine</strong><span>Deterministic Python brand rules; no AI key required</span></div><span className={`setting-status ${apiStatus === "connected" ? "enabled" : "inactive"}`}>{apiStatus === "checking" ? "Checking" : apiStatus === "connected" ? "Active" : "Unavailable"}</span></div><div className="settings-row"><div><strong>API connection</strong><span>{API_BASE_URL}</span></div><span className={`setting-status ${apiStatus === "connected" ? "enabled" : "inactive"}`}>{apiStatus === "checking" ? "Checking" : apiStatus === "connected" ? "Connected" : "Not connected"}</span></div><div className="settings-row"><div><strong>AI suggestions</strong><span>No LLM provider or API key is configured.</span></div><span className="setting-status inactive">Unavailable</span></div><div className="settings-row"><div><strong>Data retention</strong><span>Reviews and decisions are in server memory only.</span></div><span className="setting-status">Until API restart</span></div></article></section>
          )}

          <footer className="page-footer"><span>BrandGuard <span>·</span> A brand-governance demo</span><span><Icon name="shield" size={14} /> Human review recommended before publishing</span></footer>
        </div>
      </main>
    </div>
  );
}
