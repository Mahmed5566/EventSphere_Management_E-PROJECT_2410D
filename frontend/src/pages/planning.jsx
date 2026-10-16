// Planning module pages: Live Reports, QR Check-in, Activity Feed, Calendar,
// Budget and Team Tasks, plus a grounded Copilot Q&A panel.
//
// Every page talks to the real backend endpoints and renders honest loading,
// empty and error states — no fabricated statistics.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, SOCKET } from "../lib/api.js";
import { Empty, PageTitle, Modal, SkeletonPanel, SmartImage } from "../components/ui.jsx";
import { downloadWithAuth, qs, fmtDateTime, fmtDate, fmtTime, money, isoDay, monthBounds } from "../lib/planning.js";

function useEvents() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    api("/expos").then((d) => setEvents(d.expos || [])).catch(() => setEvents([]));
  }, []);
  return events;
}

function ErrorPanel({ message, onRetry }) {
  return (
    <div className="panel plan-empty">
      <i className="fa-solid fa-triangle-exclamation"></i>
      <b>Something went wrong</b>
      <span>{message}</span>
      {onRetry && <button className="ghost" onClick={onRetry}><i className="fa-solid fa-rotate"></i> Retry</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ Reports */

export function ReportsPage() {
  const events = useEvents();
  const [expo, setExpo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const p = qs({ expo, from, to });
      const [s, b] = await Promise.all([api("/analytics/summary" + p), api("/analytics/breakdown" + p)]);
      setSummary(s.summary);
      setRows(b.rows || []);
      setStatus("ready");
    } catch (e) {
      setError(e.message || "Could not load analytics.");
      setStatus("error");
    }
  }, [expo, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (kind) => {
    setNotice("");
    try {
      const p = qs({ expo, from, to });
      if (kind === "csv") await downloadWithAuth("/analytics/export.csv" + p, `eventsphere-analytics-${isoDay(Date.now())}.csv`);
      else await downloadWithAuth("/analytics/report.pdf" + p, `eventsphere-report-${isoDay(Date.now())}.pdf`);
    } catch (e) {
      setNotice(e.message || "Download failed.");
    }
  };

  const tickets = summary?.tickets || {};
  const inventory = summary?.inventory || {};
  const series = summary?.timeseries || [];
  const maxSeries = Math.max(1, ...series.map((r) => Math.max(r.tickets || 0, r.registrations || 0)));

  return (
    <div className="dash-page page-enter">
      <PageTitle
        kicker="LIVE ANALYTICS & REPORTS"
        icon="fa-chart-pie"
        title="Reports"
        copy="Metrics computed from your MongoDB records. Filter by event and date range, then export exactly what you are viewing."
        action={
          <div className="row-actions">
            <button className="ghost" onClick={() => download("csv")} disabled={status !== "ready"}>
              <i className="fa-solid fa-file-csv"></i> CSV
            </button>
            <button className="primary" onClick={() => download("pdf")} disabled={status !== "ready"}>
              <i className="fa-solid fa-file-pdf"></i> PDF report
            </button>
          </div>
        }
      />

      <div className="toolbar panel plan-filters">
        <select value={expo} onChange={(e) => setExpo(e.target.value)}>
          <option value="">All accessible events</option>
          {events.map((e) => (
            <option key={e._id} value={e._id}>{e.title}</option>
          ))}
        </select>
        <label className="plan-field">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="plan-field">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="ghost" onClick={() => { setExpo(""); setFrom(""); setTo(""); }}>
          <i className="fa-solid fa-filter-circle-xmark"></i> Clear
        </button>
      </div>

      {notice && <div className="inline-note"><i className="fa-solid fa-circle-info"></i> {notice}</div>}
      {status === "loading" && <SkeletonPanel rows={5} />}
      {status === "error" && <ErrorPanel message={error} onRetry={load} />}

      {status === "ready" && summary && (
        <>
          <div className="stats">
            {[
              ["Events", summary.events?.total ?? 0, "fa-calendar-days"],
              ["Registrations", summary.registrations?.total ?? 0, "fa-user-plus"],
              ["Tickets sold", tickets.ticketsSold ?? 0, "fa-ticket"],
              ["Revenue", money(tickets.revenue), "fa-money-bill-wave"],
              ["Check-ins", tickets.checkins ?? 0, "fa-check-to-slot"],
              ["Inventory", inventory.configured ? `${inventory.available} left` : "Not configured", "fa-boxes-stacked"],
            ].map((x) => (
              <div className="stat" key={x[0]}>
                <i className={"fa-solid " + x[2]}></i>
                <span>{x[0]}</span>
                <b>{x[1]}</b>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-head">
              <div><div className="kicker">TREND</div><h2>Registrations &amp; tickets over time</h2></div>
            </div>
            {series.length ? (
              <div className="bar-chart ds-grow">
                {series.map((r) => (
                  <div className="bar-row" key={r.date}>
                    <div className="bar-label"><span>{r.date}</span></div>
                    <div className="bar-track"><i style={{ width: `${Math.round(((r.registrations || 0) / maxSeries) * 100)}%` }}></i></div>
                    <b>{r.registrations || 0} reg · {r.tickets || 0} tix</b>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No activity in this date range." />
            )}
          </div>

          <div className="table-panel">
            <div className="table-row head"><b>Event</b><span>Status</span><span>Tickets</span><span>Revenue</span><span>Check-ins</span></div>
            {rows.map((r) => (
              <div className="table-row" key={r.event}>
                <b>{r.event}</b><span>{r.status}</span><span>{r.tickets}</span><span>{money(r.revenue)}</span><span>{r.checkins}</span>
              </div>
            ))}
            {!rows.length && <Empty text="No events match these filters." />}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Check-in/QR */

export function CheckinPage({ user }) {
  const events = useEvents();
  const [expo, setExpo] = useState("");
  const [token, setToken] = useState("");
  const [invoice, setInvoice] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [qr, setQr] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);

  const canManageTickets = ["admin", "organizer"].includes(user.role);

  useEffect(() => {
    api("/checkin/stats" + qs({ expo })).then((d) => setStats(d.stats)).catch(() => setStats(null));
  }, [expo]);

  useEffect(() => {
    if (!canManageTickets) return;
    api("/ticket-orders").then((d) => setTickets((d.tickets || []).slice(0, 25))).catch(() => setTickets([]));
  }, [user.role, canManageTickets]);

  const stopScan = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  const doCheckin = useCallback(async (payload) => {
    setBusy(true);
    setResult(null);
    try {
      const d = await api("/checkin", { method: "POST", body: JSON.stringify(payload) });
      setResult({ ok: true, message: d.message || "Checked in.", name: d.attendee?.name, event: d.event?.title });
      api("/checkin/stats" + qs({ expo })).then((x) => setStats(x.stats)).catch(() => {});
    } catch (e) {
      setResult({ ok: false, message: e.message || "Check-in failed." });
    } finally {
      setBusy(false);
    }
  }, [expo]);

  const verify = async () => {
    const value = token.trim();
    if (!value) return;
    setBusy(true);
    setResult(null);
    try {
      const d = await api("/checkin/verify/" + encodeURIComponent(value));
      setResult({ ok: d.valid, message: d.message, name: d.ticket?.attendee?.name, reason: d.reason });
    } catch (e) {
      setResult({ ok: false, message: e.message || "Verification failed." });
    } finally {
      setBusy(false);
    }
  };

  const startScan = async () => {
    if (!("BarcodeDetector" in window)) {
      setResult({ ok: false, message: "This browser cannot decode QR codes. Use manual verification below." });
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length) {
            const raw = codes[0].rawValue || "";
            const value = raw.startsWith("ES-TICKET:") ? raw.slice("ES-TICKET:".length) : raw;
            stopScan();
            setToken(value);
            doCheckin({ token: value, method: "QR" });
            return;
          }
        } catch {
          /* transient frame error - keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setResult({ ok: false, message: "Camera permission denied or unavailable. Use manual verification below." });
      stopScan();
    }
  };

  const showQr = async (id) => {
    try {
      const d = await api("/checkin/tickets/" + id + "/qr");
      setQr(d);
    } catch (e) {
      setResult({ ok: false, message: e.message || "Could not load QR code." });
    }
  };

  return (
    <div className="dash-page page-enter">
      <PageTitle
        kicker="QR TICKETING & CHECK-IN"
        icon="fa-qrcode"
        title="Check-in scanner"
        copy="Scanned tickets are verified and consumed by the backend, never by the browser. Duplicate and unpaid tickets are rejected."
        action={
          <select value={expo} onChange={(e) => setExpo(e.target.value)}>
            <option value="">All my events</option>
            {events.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
          </select>
        }
      />

      <div className="stats">
        {[
          ["Check-ins", stats?.checkins ?? "—", "fa-check-to-slot"],
          ["Paid tickets", stats?.paidOrders ?? "—", "fa-ticket"],
          ["Not yet arrived", stats?.pending ?? "—", "fa-hourglass-half"],
        ].map((x) => <div className="stat" key={x[0]}><i className={"fa-solid " + x[2]}></i><span>{x[0]}</span><b>{x[1]}</b></div>)}
      </div>

      {result && (
        <div className={"checkin-banner " + (result.ok ? "ok" : "bad")}>
          <i className={"fa-solid " + (result.ok ? "fa-circle-check" : "fa-circle-xmark")}></i>
          <div>
            <b>{result.message}</b>
            {(result.name || result.event) && <small>{result.name || "Attendee"}{result.event ? ` · ${result.event}` : ""}</small>}
          </div>
        </div>
      )}

      <div className="plan-split">
        <div className="panel">
          <div className="panel-head"><div><div className="kicker">CAMERA</div><h2>Scan attendee QR</h2></div></div>
          <div className={"scan-stage" + (scanning ? " live" : "")}>
            <video ref={videoRef} muted playsInline />
            {!scanning && <span className="scan-hint"><i className="fa-solid fa-qrcode"></i> Camera idle</span>}
          </div>
          <div className="row-actions">
            {!scanning && <button className="primary" onClick={startScan}><i className="fa-solid fa-video"></i> Start camera</button>}
            {scanning && <button className="danger" onClick={stopScan}><i className="fa-solid fa-stop"></i> Stop</button>}
          </div>
          <small className="muted">Requires a browser with the BarcodeDetector API and camera permission. Manual entry always works.</small>
        </div>

        <div className="panel">
          <div className="panel-head"><div><div className="kicker">MANUAL FALLBACK</div><h2>Verify &amp; check in</h2></div></div>
          <label className="plan-label">Ticket token</label>
          <input placeholder="Paste the ticket token" value={token} onChange={(e) => setToken(e.target.value)} />
          <div className="row-actions">
            <button className="ghost" onClick={verify} disabled={busy}><i className="fa-solid fa-magnifying-glass"></i> Verify only</button>
            <button className="primary" onClick={() => doCheckin({ token: token.trim(), method: "manual" })} disabled={busy || !token.trim()}>
              <i className="fa-solid fa-right-to-bracket"></i> Check in
            </button>
          </div>
          <label className="plan-label">or invoice number</label>
          <input placeholder="ES-…" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          <button className="ghost wide" onClick={() => doCheckin({ invoiceNo: invoice.trim(), method: "manual" })} disabled={busy || !invoice.trim()}>
            <i className="fa-solid fa-receipt"></i> Check in by invoice
          </button>
        </div>
      </div>

      {canManageTickets && (
        <div className="table-panel">
          <div className="table-row head"><b>Invoice</b><span>Attendee</span><span>Pass</span><span>Status</span><span>QR</span></div>
          {tickets.map((t) => (
            <div className="table-row" key={t._id}>
              <b>{t.invoiceNo || t._id.slice(-6)}</b>
              <span>{t.attendee?.name || "—"}</span>
              <span>{t.passType}</span>
              <span>{t.checkedInAt ? "Checked in" : t.status}</span>
              <span><button className="ghost small" onClick={() => showQr(t._id)}><i className="fa-solid fa-qrcode"></i></button></span>
            </div>
          ))}
          {!tickets.length && <Empty text="No tickets issued yet." />}
        </div>
      )}

      {qr && (
        <Modal title="Ticket QR" onClose={() => setQr(null)}>
          <div className="qr-modal">
            <SmartImage src={qr.qr} alt={`QR code for ticket ${qr.ticket?.invoiceNo || ""}`.trim()} ratio="1 / 1" className="qr-media" loading="eager" fallbackIcon="fa-qrcode" />
            <div>
              <b>{qr.ticket?.invoiceNo || "Ticket"}</b>
              <small>{qr.ticket?.passType} · {qr.ticket?.status}</small>
              <small className="muted">This QR contains only an opaque server token.</small>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Activity feed */

const ENTITY_TYPES = ["Event", "Ticket", "Session", "Booth", "BoothLayout", "Task", "Budget", "Venue"];

export function ActivityPage({ user }) {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [status, setStatus] = useState("loading");
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);

  const loadPage = useCallback((nextPage) => {
    setStatus("loading");
    api("/activity" + qs({ page: nextPage, limit: 25, entityType, q: appliedQ }))
      .then((d) => {
        setItems((prev) => (nextPage === 1 ? d.items || [] : [...prev, ...(d.items || [])]));
        setPage(nextPage);
        setHasMore(Boolean(d.hasMore));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [entityType, appliedQ]);

  useEffect(() => { loadPage(1); }, [loadPage]);

  const loadNotifs = useCallback(() => {
    api("/notifications" + qs({ limit: 20 }))
      .then((d) => { setNotifs(d.notifications || []); setUnread(d.unread || 0); })
      .catch(() => {});
  }, []);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  useEffect(() => {
    const s = io(SOCKET, { auth: { token: localStorage.getItem("es_token") } });
    s.on("notification:new", loadNotifs);
    s.on("activity:new", (a) => setItems((prev) => [a, ...prev]));
    return () => s.disconnect();
  }, [loadNotifs]);

  const markRead = async (id) => {
    try { await api("/notifications/" + id + "/read", { method: "PUT" }); loadNotifs(); } catch { /* ignore */ }
  };
  const markAll = async () => {
    try { await api("/notifications/read-all", { method: "PUT" }); loadNotifs(); } catch { /* ignore */ }
  };

  return (
    <div className="dash-page page-enter">
      <PageTitle
        kicker="ACTIVITY & ALERTS"
        icon="fa-bell"
        title="Activity feed"
        copy="A persistent record of meaningful actions, plus your personal notifications. Live updates stream over Socket.IO."
        action={
          <button className="ghost" onClick={() => { loadPage(1); loadNotifs(); }}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        }
      />

      <div className="plan-split">
        <div className="panel">
          <div className="panel-head">
            <div><div className="kicker">NOTIFICATIONS</div><h2><i className="fa-solid fa-bell"></i> {unread} unread</h2></div>
            {unread > 0 && <button className="ghost small" onClick={markAll}>Mark all read</button>}
          </div>
          {notifs.map((n) => (
            <button className={"notif-row" + (n.read ? "" : " unread")} key={n._id} onClick={() => markRead(n._id)}>
              <i className={"fa-solid " + (n.read ? "fa-envelope-open" : "fa-envelope")}></i>
              <div><b>{n.title}</b><small>{n.message}</small><em>{fmtDateTime(n.createdAt)}</em></div>
            </button>
          ))}
          {!notifs.length && <Empty text="You have no notifications yet." />}
        </div>

        <div className="panel">
          <div className="panel-head"><div><div className="kicker">FEED</div><h2>Recent activity</h2></div></div>
          <div className="toolbar plan-inline">
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">All types</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Search summary…" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setAppliedQ(q); }} />
            <button className="ghost small" onClick={() => setAppliedQ(q)}><i className="fa-solid fa-magnifying-glass"></i></button>
          </div>
          {status === "loading" && !items.length && <SkeletonPanel rows={4} />}
          {status === "error" && <ErrorPanel message="Could not load the activity feed." onRetry={() => loadPage(1)} />}
          <div className="feed ds-stagger">
            {items.map((a) => (
              <div className="feed-item" key={a._id}>
                <span className={"feed-dot action-" + a.action}></span>
                <div>
                  <b>{a.summary || `${a.action} ${a.entityType}`}</b>
                  <small>{a.actorName || "System"} · {a.entityType} · {fmtDateTime(a.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
          {!items.length && status === "ready" && <Empty text="No activity recorded yet." />}
          {hasMore && <button className="ghost wide" onClick={() => loadPage(page + 1)}>Load more</button>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Calendar */

function buildMonthGrid(cursor) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export function CalendarPage() {
  const events = useEvents();
  const [expo, setExpo] = useState("");
  const [cursor, setCursor] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [status, setStatus] = useState("loading");

  const bounds = useMemo(() => monthBounds(cursor), [cursor]);
  const from = bounds.start.toISOString();
  const to = bounds.end.toISOString();

  const load = useCallback(() => {
    setStatus("loading");
    api("/calendar" + qs({ expo, from, to }))
      .then((d) => { setSessions(d.sessions || []); setConflicts(d.conflicts || []); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [expo, from, to]);

  useEffect(() => { load(); }, [load]);

  const cells = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const byDay = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      const key = isoDay(s.startTime);
      (map[key] = map[key] || []).push(s);
    });
    return map;
  }, [sessions]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayKey = isoDay(Date.now());

  return (
    <div className="dash-page page-enter">
      <PageTitle
        kicker="CALENDAR & CONFLICT DETECTION"
        icon="fa-calendar-check"
        title="Schedule calendar"
        copy="Month view of every session. Overlapping rooms and double-booked speakers are detected on the backend."
        action={
          <div className="row-actions">
            <select value={expo} onChange={(e) => setExpo(e.target.value)}>
              <option value="">All my events</option>
              {events.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
            </select>
            <button className="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month"><i className="fa-solid fa-chevron-left"></i></button>
            <b className="cal-month">{monthLabel}</b>
            <button className="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        }
      />

      {status === "loading" && <SkeletonPanel rows={5} />}
      {status === "error" && <ErrorPanel message="Could not load the calendar." onRetry={load} />}
      {status === "ready" && (
        <>
          <div className="cal-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div className="cal-head" key={d}>{d}</div>)}
            {cells.map((d) => {
              const key = isoDay(d);
              const daySessions = byDay[key] || [];
              const outside = d.getMonth() !== cursor.getMonth();
              return (
                <div className={"cal-cell" + (outside ? " outside" : "") + (key === todayKey ? " today" : "")} key={key}>
                  <span className="cal-day">{d.getDate()}</span>
                  {daySessions.slice(0, 3).map((s) => (
                    <span className="cal-chip" key={s._id} title={`${s.title} · ${s.location || "room tba"}`}>
                      <i className="fa-solid fa-microphone-lines"></i> {s.title}
                    </span>
                  ))}
                  {daySessions.length > 3 && <small className="muted">+{daySessions.length - 3} more</small>}
                </div>
              );
            })}
          </div>

          {conflicts.length > 0 && (
            <div className="panel conflict-panel">
              <div className="panel-head"><div><div className="kicker">CONFLICTS</div><h2><i className="fa-solid fa-triangle-exclamation"></i> {conflicts.length} scheduling conflicts</h2></div></div>
              {conflicts.map((c, i) => <div className="conflict-row" key={i}><i className="fa-solid fa-circle-exclamation"></i> {c.message}</div>)}
            </div>
          )}

          <div className="table-panel">
            <div className="table-row head"><b>Session</b><span>Speaker</span><span>Room</span><span>Starts</span><span>Ends</span></div>
            {sessions.map((s) => (
              <div className="table-row" key={s._id}>
                <b>{s.title}</b>
                <span>{s.speaker || "—"}</span>
                <span>{s.location || "—"}</span>
                <span>{fmtDateTime(s.startTime)}</span>
                <span>{fmtTime(s.endTime)}</span>
              </div>
            ))}
            {!sessions.length && <Empty text="No sessions scheduled this month." />}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Budget */

export function BudgetPage() {
  const events = useEvents();
  const [expo, setExpo] = useState("");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("idle");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ type: "expense", entryType: "actual", category: "", description: "", amount: "", currency: "PKR", date: "" });

  useEffect(() => {
    if (!expo && events[0]) setExpo(events[0]._id);
  }, [events, expo]);

  const load = useCallback(() => {
    if (!expo) return;
    setStatus("loading");
    api("/budget" + qs({ expo }))
      .then((d) => { setItems(d.items || []); setSummary(d.summary || null); setStatus("ready"); })
      .catch((e) => { setNotice(e.message || "Could not load budget."); setStatus("error"); });
  }, [expo]);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = JSON.stringify({ ...form, expo, amount: Number(form.amount) });
      await api(edit ? "/budget/" + edit._id : "/budget", { method: edit ? "PUT" : "POST", body });
      setOpen(false); setEdit(null);
      setForm({ type: "expense", entryType: "actual", category: "", description: "", amount: "", currency: "PKR", date: "" });
      load();
    } catch (err) { setNotice(err.message); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this budget entry?")) return;
    try { await api("/budget/" + id, { method: "DELETE" }); load(); } catch (e) { setNotice(e.message); }
  };

  const totals = summary?.totals || {};
  const categories = summary?.categories || {};

  return (
    <div className="dash-page page-enter">
      <PageTitle
        kicker="BUDGET & FINANCE"
        icon="fa-wallet"
        title="Budget"
        copy="Planned budget versus recorded expenses. Amounts, currencies and totals are validated on the backend."
        action={
          <div className="row-actions">
            <select value={expo} onChange={(e) => setExpo(e.target.value)}>
              {events.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
            </select>
            <button className="ghost" onClick={() => downloadWithAuth("/budget/export.csv" + qs({ expo }), "eventsphere-budget.csv").catch((e) => setNotice(e.message))} disabled={!expo}>
              <i className="fa-solid fa-file-csv"></i> Export
            </button>
            <button className="primary" onClick={() => { setEdit(null); setOpen(true); }} disabled={!expo}><i className="fa-solid fa-plus"></i> Add entry</button>
          </div>
        }
      />

      {notice && <div className="inline-note"><i className="fa-solid fa-circle-info"></i> {notice}</div>}
      {!expo && <Empty text="Create an event first to start tracking a budget." />}
      {status === "loading" && <SkeletonPanel rows={5} />}
      {status === "error" && <ErrorPanel message="Could not load budget." onRetry={load} />}

      {status === "ready" && (
        <>
          <div className="stats">
            {[
              ["Planned", money(totals.plannedExpense), "fa-clipboard-list"],
              ["Actual", money(totals.actualExpense), "fa-money-bill-transfer"],
              ["Income", money(totals.income), "fa-sack-dollar"],
              ["Remaining", money(totals.remaining), "fa-scale-balanced"],
              ["Net", money(totals.net), "fa-chart-pie"],
            ].map((x) => <div className="stat" key={x[0]}><i className={"fa-solid " + x[2]}></i><span>{x[0]}</span><b>{x[1]}</b></div>)}
          </div>

          <div className="plan-split">
            <div className="panel">
              <div className="panel-head"><div><div className="kicker">BY CATEGORY</div><h2>Expense breakdown</h2></div></div>
              {Object.keys(categories).length ? (
                <div className="bar-chart ds-grow">
                  {Object.entries(categories).map(([name, c]) => {
                    const max = Math.max(1, ...Object.values(categories).map((v) => Math.max(v.planned, v.actual)));
                    return (
                      <div className="bar-row" key={name}>
                        <div className="bar-label"><span>{name}</span></div>
                        <div className="bar-track"><i style={{ width: `${Math.round(((c.actual || 0) / max) * 100)}%` }}></i></div>
                        <b>{money(c.actual)} / {money(c.planned)}</b>
                      </div>
                    );
                  })}
                </div>
              ) : <Empty text="No expenses recorded yet." />}
            </div>

            <div className="table-panel">
              <div className="table-row head"><b>Category</b><span>Type</span><span>Amount</span><span>Date</span><span></span></div>
              {items.map((i) => (
                <div className="table-row" key={i._id}>
                  <b>{i.category || i.description || "Entry"}</b>
                  <span>{i.entryType} · {i.type}</span>
                  <span>{money(i.amount, i.currency)}</span>
                  <span>{fmtDate(i.date)}</span>
                  <span className="row-actions">
                    <button className="ghost small" onClick={() => { setEdit(i); setForm({ type: i.type, entryType: i.entryType, category: i.category || "", description: i.description || "", amount: i.amount, currency: i.currency || "PKR", date: i.date ? isoDay(i.date) : "" }); setOpen(true); }}><i className="fa-solid fa-pen"></i></button>
                    <button className="danger small" onClick={() => remove(i._id)}><i className="fa-solid fa-trash"></i></button>
                  </span>
                </div>
              ))}
              {!items.length && <Empty text="No budget entries yet." />}
            </div>
          </div>
        </>
      )}

      {open && (
        <Modal title={edit ? "Edit budget entry" : "Add budget entry"} onClose={() => setOpen(false)}>
          <form className="form-grid" onSubmit={save}>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select value={form.entryType} onChange={(e) => setForm({ ...form, entryType: e.target.value })}>
              <option value="actual">Recorded (actual)</option>
              <option value="planned">Planned budget</option>
            </select>
            <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input type="number" min="0" step="0.01" required placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {["PKR", "USD", "EUR", "GBP", "AED", "SAR", "INR"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <button className="primary wide full-col">Save entry</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Team tasks */

const STATUS_COLUMNS = [["todo", "To Do"], ["in-progress", "In Progress"], ["completed", "Completed"]];
const PRIORITIES = ["low", "medium", "high", "critical"];

export function TasksPage() {
  const events = useEvents();
  const [expo, setExpo] = useState("");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [staff, setStaff] = useState([]);
  const [status, setStatus] = useState("idle");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", status: "todo", dueDate: "", assignee: "" });

  useEffect(() => { if (!expo && events[0]) setExpo(events[0]._id); }, [events, expo]);

  useEffect(() => {
    api("/staff").then((d) => setStaff((d.staff || d.members || []).map((s) => ({ id: s.user?._id || s._id, name: s.user?.name || s.name || s.email || "Member" })))).catch(() => setStaff([]));
  }, []);

  const load = useCallback(() => {
    if (!expo) return;
    setStatus("loading");
    api("/tasks" + qs({ expo, limit: 200 }))
      .then((d) => { setItems(d.items || []); setSummary(d.summary || null); setStatus("ready"); })
      .catch((e) => { setNotice(e.message || "Could not load tasks."); setStatus("error"); });
  }, [expo]);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = JSON.stringify({ ...form, expo, assignee: form.assignee || null, dueDate: form.dueDate || null });
      await api(edit ? "/tasks/" + edit._id : "/tasks", { method: edit ? "PUT" : "POST", body });
      setOpen(false); setEdit(null);
      setForm({ title: "", description: "", priority: "medium", status: "todo", dueDate: "", assignee: "" });
      load();
    } catch (err) { setNotice(err.message); }
  };

  const move = async (task, next) => {
    try { await api("/tasks/" + task._id, { method: "PUT", body: JSON.stringify({ status: next }) }); load(); }
    catch (e) { setNotice(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    try { await api("/tasks/" + id, { method: "DELETE" }); load(); } catch (e) { setNotice(e.message); }
  };

  const isOverdue = (t) => t.dueDate && t.status !== "completed" && new Date(t.dueDate) < new Date();

  return (
    <div className="dash-page page-enter">
      <PageTitle
        kicker="BUDGET & TEAM TASKS"
        icon="fa-list-check"
        title="Team tasks"
        copy="Assign work to real accounts, track status and surface overdue items using timezone-correct comparisons."
        action={
          <div className="row-actions">
            <select value={expo} onChange={(e) => setExpo(e.target.value)}>
              {events.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
            </select>
            <button className="primary" onClick={() => { setEdit(null); setForm({ title: "", description: "", priority: "medium", status: "todo", dueDate: "", assignee: "" }); setOpen(true); }} disabled={!expo}>
              <i className="fa-solid fa-plus"></i> Add task
            </button>
          </div>
        }
      />

      {notice && <div className="inline-note"><i className="fa-solid fa-circle-info"></i> {notice}</div>}
      {!expo && <Empty text="Create an event first to plan team tasks." />}
      {status === "loading" && <SkeletonPanel rows={5} />}
      {status === "error" && <ErrorPanel message="Could not load tasks." onRetry={load} />}

      {status === "ready" && (
        <>
          <div className="stats">
            {[
              ["To do", summary?.todo ?? 0, "fa-list-check"],
              ["In progress", summary?.["in-progress"] ?? 0, "fa-spinner"],
              ["Completed", summary?.completed ?? 0, "fa-circle-check"],
              ["Overdue", summary?.overdue ?? 0, "fa-triangle-exclamation"],
            ].map((x) => <div className="stat" key={x[0]}><i className={"fa-solid " + x[2]}></i><span>{x[0]}</span><b>{x[1]}</b></div>)}
          </div>

          <div className="kanban ds-stagger">
            {STATUS_COLUMNS.map(([key, label]) => (
              <div className="kanban-col panel" key={key}>
                <div className="panel-head"><div><div className="kicker">{label.toUpperCase()}</div><h2>{items.filter((t) => t.status === key).length} tasks</h2></div></div>
                {items.filter((t) => t.status === key).map((t) => (
                  <article className={"task-card priority-" + t.priority + (isOverdue(t) ? " overdue" : "")} key={t._id}>
                    <div className="task-top"><b>{t.title}</b><span className="chip">{t.priority}</span></div>
                    {t.description && <small>{t.description}</small>}
                    <div className="task-meta">
                      <span><i className="fa-solid fa-user"></i> {t.assignee?.name || "Unassigned"}</span>
                      {t.dueDate && <span className={isOverdue(t) ? "danger-text" : ""}><i className="fa-regular fa-clock"></i> {fmtDate(t.dueDate)}</span>}
                    </div>
                    <div className="row-actions">
                      {key !== "todo" && <button className="ghost small" onClick={() => move(t, key === "completed" ? "in-progress" : "todo")}><i className="fa-solid fa-arrow-left"></i></button>}
                      {key !== "completed" && <button className="primary small" onClick={() => move(t, key === "todo" ? "in-progress" : "completed")}>{key === "todo" ? "Start" : "Complete"}</button>}
                      <button className="ghost small" onClick={() => { setEdit(t); setForm({ title: t.title, description: t.description || "", priority: t.priority, status: t.status, dueDate: t.dueDate ? isoDay(t.dueDate) : "", assignee: t.assignee?._id || t.assignee || "" }); setOpen(true); }}><i className="fa-solid fa-pen"></i></button>
                      <button className="danger small" onClick={() => remove(t._id)}><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </article>
                ))}
                {!items.filter((t) => t.status === key).length && <Empty text={`No ${label.toLowerCase()} tasks.`} />}
              </div>
            ))}
          </div>
        </>
      )}

      {open && (
        <Modal title={edit ? "Edit task" : "Add task"} onClose={() => setOpen(false)}>
          <form className="form-grid" onSubmit={save}>
            <input required placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_COLUMNS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <textarea className="full-col" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button className="primary wide full-col">Save task</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- Copilot (live) */

export function CopilotAsk({ user }) {
  const events = useEvents();
  const [expo, setExpo] = useState("");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/copilot/status").then((d) => setStatus(d)).catch(() => setStatus({ configured: false, message: "Could not reach the copilot status endpoint." }));
  }, []);

  const ask = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const d = await api("/copilot/ask", { method: "POST", body: JSON.stringify({ question, expo }) });
      setAnswer(d);
    } catch (err) {
      setAnswer({ success: false, configured: true, message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dash-page page-enter">
      <div className="panel copilot-ask">
      <div className="panel-head">
        <div><div className="kicker">GROUNDED Q&amp;A</div><h2><i className="fa-solid fa-comments"></i> Ask your event data</h2></div>
        <span className={"live-pill" + (status?.configured ? "" : " off")}>
          <i></i> {status?.configured ? `${status.provider} ready` : "not configured"}
        </span>
      </div>
      {status && !status.configured && (
        <div className="inline-note"><i className="fa-solid fa-plug-circle-exclamation"></i> {status.message || "No AI provider configured."} Answers stay grounded in authorized data only.</div>
      )}
      <form className="plan-inline" onSubmit={ask}>
        <select value={expo} onChange={(e) => setExpo(e.target.value)}>
          <option value="">All accessible events</option>
          {events.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
        </select>
        <input placeholder="e.g. Which upcoming events need attention?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button className="primary" disabled={busy || !question.trim()}>{busy ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>} Ask</button>
      </form>
      {answer?.answer && <div className="copilot-answer"><i className="fa-solid fa-robot"></i><p>{answer.answer}</p></div>}
      {answer && !answer.answer && <div className="inline-note">{answer.message}</div>}
      <small className="muted">The model only receives a JSON summary of data {user.role} is authorised to see; it cannot query the database directly.</small>
      </div>
    </div>
  );
}
