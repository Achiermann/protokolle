"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Pencil,
  Plus,
  Trash,
} from "lucide-react";
import toast from "react-hot-toast";
import { useChangelogStore, getUnseen } from "../stores/useChangelogStore";
import { useAuthStore } from "../stores/useAuthStore";
import LogForm from "./LogForm";
import LogComments, { formatCommentDate } from "./LogComments";
import VorgangForm from "./VorgangForm";
import "../../styles/changelog.css";
// The new-button, topic colours and action buttons reuse entry-list styling.
import "../../styles/entry-list.css";
import "../../styles/filters.css";

const NO_TOPIC = "Ohne Thema";

const getTopicColorClass = (value) => {
  if (!value) return "";
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return `entry-list-item-topic-c${Math.abs(hash) % 10}`;
};

// Same normalisation and capitalisation as the ToDo list, so an author gets
// the same colour chip and label there and here.
const normalizeMemberKey = (name) => (name || "").trim().toLowerCase();
const formatMemberName = (name) =>
  normalizeMemberKey(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// log_date is a plain YYYY-MM-DD; split it rather than going through Date,
// which would read it as UTC midnight. Shown as dd/mm/yy.
const formatDate = (isoDate) => {
  if (!isoDate) return "-";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year.slice(2)}`;
};

// Newest log first; same-day logs by creation time.
const compareLogs = (a, b) =>
  b.log_date.localeCompare(a.log_date) ||
  b.created_at.localeCompare(a.created_at);

export default function Changelog() {
  // *** VARIABLES ***
  const vorgaenge = useChangelogStore((state) => state.vorgaenge);
  const logs = useChangelogStore((state) => state.logs);
  const comments = useChangelogStore((state) => state.comments);
  const loading = useChangelogStore((state) => state.loading);
  const ensureChangelog = useChangelogStore((state) => state.ensureChangelog);
  const deleteLog = useChangelogStore((state) => state.deleteLog);
  const deleteVorgang = useChangelogStore((state) => state.deleteVorgang);
  const seenSince = useChangelogStore((state) => state.seenSince);
  const seenIds = useChangelogStore((state) => state.seenIds);
  const markSeen = useChangelogStore((state) => state.markSeen);
  const userId = useAuthStore((state) => state.user?.id);

  const [showLogForm, setShowLogForm] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editingVorgang, setEditingVorgang] = useState(null);
  // Themen start open, Vorgänge closed; each set holds the exceptions.
  const [collapsedTopics, setCollapsedTopics] = useState(new Set());
  const [openVorgaenge, setOpenVorgaenge] = useState(new Set());
  // Logs whose comment thread is unfolded (closed by default).
  const [openLogs, setOpenLogs] = useState(new Set());
  const [search, setSearch] = useState("");

  const vorgaengeById = useMemo(
    () => new Map(vorgaenge.map((v) => [v.id, v])),
    [vorgaenge],
  );
  const logsById = useMemo(() => new Map(logs.map((l) => [l.id, l])), [logs]);

  const unseen = useMemo(
    () => getUnseen({ logs, comments, seenSince, seenIds }, userId),
    [logs, comments, seenSince, seenIds, userId],
  );

  // Overview rows for unseen logs and comments, newest first.
  const unseenItems = useMemo(
    () =>
      [
        ...unseen.logs.map((log) => ({ type: "log", item: log, log })),
        ...unseen.comments.map((comment) => ({
          type: "comment",
          item: comment,
          log: logsById.get(comment.log_id),
        })),
      ]
        .filter((row) => row.log && vorgaengeById.has(row.log.vorgang_id))
        .sort((a, b) => b.item.created_at.localeCompare(a.item.created_at)),
    [unseen, logsById, vorgaengeById],
  );

  // Comments per log, oldest first (the API already sorts them).
  const commentsByLog = useMemo(() => {
    const map = new Map();
    for (const comment of comments) {
      if (!map.has(comment.log_id)) map.set(comment.log_id, []);
      map.get(comment.log_id).push(comment);
    }
    return map;
  }, [comments]);

  // Thema → Vorgänge → Logs. Themen and Vorgänge alphabetical, "Ohne Thema"
  // last; Vorgänge without logs still show so they can be edited or deleted.
  const groups = useMemo(() => {
    const logsByVorgang = new Map();
    for (const log of logs) {
      if (!logsByVorgang.has(log.vorgang_id)) {
        logsByVorgang.set(log.vorgang_id, []);
      }
      logsByVorgang.get(log.vorgang_id).push(log);
    }

    const byTopic = new Map();
    for (const vorgang of vorgaenge) {
      const key = vorgang.topic || "";
      if (!byTopic.has(key)) byTopic.set(key, []);
      byTopic.get(key).push({
        vorgang,
        logs: (logsByVorgang.get(vorgang.id) || []).sort(compareLogs),
      });
    }

    return Array.from(byTopic.entries())
      .map(([topic, items]) => ({
        topic,
        items: items.sort((a, b) =>
          a.vorgang.name.localeCompare(b.vorgang.name, "de"),
        ),
      }))
      .sort((a, b) => {
        if (!a.topic) return 1;
        if (!b.topic) return -1;
        return a.topic.localeCompare(b.topic, "de");
      });
  }, [vorgaenge, logs]);

  // Search across Thema, Vorgang, log text, comments and names. A Vorgang hit
  // keeps all its logs; otherwise only matching logs stay. Logs that match
  // through a comment get their thread unfolded.
  const query = search.trim().toLowerCase();
  const { visibleGroups, searchOpenLogs } = useMemo(() => {
    if (!query) return { visibleGroups: groups, searchOpenLogs: new Set() };
    const hit = (text) => (text || "").toLowerCase().includes(query);
    const openThreads = new Set();
    const result = [];
    for (const group of groups) {
      const items = [];
      for (const { vorgang, logs: vorgangLogs } of group.items) {
        const vorgangHit = hit(vorgang.name) || hit(group.topic);
        const matching = vorgangLogs.filter((log) => {
          const commentHit = (commentsByLog.get(log.id) || []).some(
            (c) => hit(c.body) || hit(c.created_by_name),
          );
          if (commentHit) openThreads.add(log.id);
          return hit(log.change) || hit(log.created_by_name) || commentHit;
        });
        if (vorgangHit || matching.length > 0) {
          items.push({ vorgang, logs: vorgangHit ? vorgangLogs : matching });
        }
      }
      if (items.length > 0) result.push({ topic: group.topic, items });
    }
    return { visibleGroups: result, searchOpenLogs: openThreads };
  }, [groups, query, commentsByLog]);
  const isSearching = query.length > 0;

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    ensureChangelog();
  }, [ensureChangelog]);

  // "Seen" means unfolded by hand: a log once its Vorgang (and Thema) is
  // open, a comment once its log thread is open too. Search-unfolding
  // doesn't count.
  useEffect(() => {
    const isVorgangVisible = (vorgangId) => {
      const vorgang = vorgaengeById.get(vorgangId);
      return (
        vorgang &&
        openVorgaenge.has(vorgangId) &&
        !collapsedTopics.has(vorgang.topic || "")
      );
    };
    const ids = [
      ...unseen.logs
        .filter((log) => isVorgangVisible(log.vorgang_id))
        .map((log) => log.id),
      ...unseen.comments
        .filter((comment) => {
          const log = logsById.get(comment.log_id);
          return (
            log && openLogs.has(log.id) && isVorgangVisible(log.vorgang_id)
          );
        })
        .map((comment) => comment.id),
    ];
    if (ids.length > 0) markSeen(ids);
  }, [
    unseen,
    openVorgaenge,
    openLogs,
    collapsedTopics,
    vorgaengeById,
    logsById,
    markSeen,
  ]);

  // Unfold the path to an overview item (which marks it seen) and scroll to
  // its log line once rendered.
  const handleJump = ({ type, log }) => {
    const vorgang = vorgaengeById.get(log.vorgang_id);
    setSearch("");
    setCollapsedTopics((prev) => {
      const next = new Set(prev);
      next.delete(vorgang?.topic || "");
      return next;
    });
    setOpenVorgaenge((prev) => new Set(prev).add(log.vorgang_id));
    if (type === "comment") {
      setOpenLogs((prev) => new Set(prev).add(log.id));
    }
    setTimeout(() => {
      document
        .getElementById(`changelog-log-${log.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleMarkAllSeen = () => {
    markSeen(unseenItems.map((row) => row.item.id));
  };

  const toggleInSet = (setter, key) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDeleteLog = async (log) => {
    if (!confirm("Log löschen?")) return;
    try {
      await deleteLog(log.id);
      toast.success("Log gelöscht");
    } catch (error) {
      toast.error("Log konnte nicht gelöscht werden");
    }
  };

  const handleDeleteVorgang = async (vorgang, logCount) => {
    const message =
      logCount > 0
        ? `Vorgang "${vorgang.name}" mit ${logCount} Log${logCount === 1 ? "" : "s"} löschen?`
        : `Vorgang "${vorgang.name}" löschen?`;
    if (!confirm(message)) return;
    try {
      await deleteVorgang(vorgang.id);
      toast.success("Vorgang gelöscht");
    } catch (error) {
      toast.error("Vorgang konnte nicht gelöscht werden");
    }
  };

  // One line per log: date, author chip (as in the ToDo list), text, comment
  // count, actions. Clicking the line unfolds its comment thread.
  const renderLogs = (vorgangLogs) => (
    <ul className="changelog-logs">
      {vorgangLogs.map((log) => {
        const name = formatMemberName(log.created_by_name);
        const logComments = commentsByLog.get(log.id) || [];
        const isLogOpen = openLogs.has(log.id) || searchOpenLogs.has(log.id);
        return (
          <li
            key={log.id}
            id={`changelog-log-${log.id}`}
            className="changelog-log-item"
          >
            <div
              className={`changelog-log${isLogOpen ? " changelog-log-open" : ""}`}
              onClick={() => toggleInSet(setOpenLogs, log.id)}
            >
              <span className="changelog-log-date">
                {formatDate(log.log_date)}
              </span>
              {name ? (
                <span
                  className={`entry-list-item-topic changelog-log-who ${getTopicColorClass(normalizeMemberKey(log.created_by_name))}`}
                >
                  {name}
                </span>
              ) : (
                <span className="changelog-log-date">-</span>
              )}
              <span className="changelog-log-change">{log.change}</span>
              {logComments.length > 0 && (
                <span
                  className="changelog-log-comment-count"
                  title={`${logComments.length} Kommentar${logComments.length === 1 ? "" : "e"}`}
                >
                  <MessageSquare size={14} />
                  {logComments.length}
                </span>
              )}
              <div
                className="entry-list-item-actions changelog-log-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditingLog(log)}
                  title="Log bearbeiten"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleDeleteLog(log)}
                  title="Log löschen"
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
            {isLogOpen && <LogComments log={log} comments={logComments} />}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="changelog">
      <button
        type="button"
        className="entry-list-new-button"
        onClick={() => setShowLogForm(true)}
      >
        <Plus size={18} />
        Neuer Log
      </button>

      <div className="changelog-header">
        <h2>Changelog</h2>
      </div>

      {unseenItems.length > 0 && (
        <div className="changelog-unseen">
          <div className="changelog-unseen-header">
            <h3>Neu ({unseenItems.length})</h3>
            <button
              type="button"
              className="secondary"
              onClick={handleMarkAllSeen}
            >
              Alle als gelesen markieren
            </button>
          </div>
          <ul className="changelog-unseen-list">
            {unseenItems.map((row) => {
              const vorgang = vorgaengeById.get(row.log.vorgang_id);
              return (
                <li
                  key={row.item.id}
                  className="changelog-unseen-item"
                  onClick={() => handleJump(row)}
                >
                  <span className="changelog-unseen-path">
                    {vorgang.topic || NO_TOPIC} › {vorgang.name}
                  </span>
                  <span className="changelog-unseen-line">
                    <span className="changelog-log-date">
                      {row.type === "log"
                        ? formatDate(row.item.log_date)
                        : formatCommentDate(row.item.created_at)}
                    </span>
                    <span className="log-comments-author">
                      {row.item.created_by_name || "?"}
                      {row.type === "comment" ? " (Kommentar)" : ""}:
                    </span>
                    <span className="changelog-unseen-text">
                      {row.type === "log" ? row.item.change : row.item.body}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="filters-container">
        <div className="filter-field">
          <label htmlFor="changelog-search">Suche</label>
          <input
            type="text"
            id="changelog-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nach Begriff filtern..."
          />
        </div>
      </div>

      {loading && <p>Changelog wird geladen...</p>}

      {!loading && groups.length === 0 && (
        <div className="changelog-empty">
          <p>Noch keine Logs.</p>
        </div>
      )}

      {!loading && groups.length > 0 && visibleGroups.length === 0 && (
        <div className="changelog-empty">
          <p>Keine Logs entsprechen deiner Suche.</p>
        </div>
      )}

      {!loading &&
        visibleGroups.map((group) => {
          const isTopicOpen = isSearching || !collapsedTopics.has(group.topic);
          return (
            <section key={group.topic || NO_TOPIC} className="changelog-topic">
              <div
                className="changelog-topic-bar"
                onClick={() => toggleInSet(setCollapsedTopics, group.topic)}
              >
                {isTopicOpen ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
                <span
                  className={`entry-list-item-topic ${getTopicColorClass(group.topic)}`}
                >
                  {group.topic || NO_TOPIC}
                </span>
                <span className="changelog-count">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "Vorgang" : "Vorgänge"}
                </span>
              </div>

              {isTopicOpen &&
                group.items.map(({ vorgang, logs: vorgangLogs }) => {
                  const isVorgangOpen =
                    isSearching || openVorgaenge.has(vorgang.id);
                  return (
                    <div key={vorgang.id} className="changelog-vorgang">
                      <div
                        className="changelog-vorgang-bar"
                        onClick={() =>
                          toggleInSet(setOpenVorgaenge, vorgang.id)
                        }
                      >
                        {isVorgangOpen ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                        <span className="changelog-vorgang-name">
                          {vorgang.name}
                        </span>
                        <span className="changelog-count">
                          {vorgangLogs.length}{" "}
                          {vorgangLogs.length === 1 ? "Log" : "Logs"}
                          {vorgangLogs.length > 0 &&
                            ` · zuletzt ${formatDate(vorgangLogs[0].log_date)}`}
                        </span>
                        <div
                          className="entry-list-item-actions changelog-vorgang-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setEditingVorgang(vorgang)}
                            title="Vorgang bearbeiten"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              handleDeleteVorgang(vorgang, vorgangLogs.length)
                            }
                            title="Vorgang löschen"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </div>

                      {isVorgangOpen &&
                        vorgangLogs.length > 0 &&
                        renderLogs(vorgangLogs)}
                      {isVorgangOpen && vorgangLogs.length === 0 && (
                        <p className="changelog-vorgang-empty">
                          Noch keine Logs.
                        </p>
                      )}
                    </div>
                  );
                })}
            </section>
          );
        })}

      {showLogForm && (
        <div
          className="entry-form-overlay"
          onClick={() => setShowLogForm(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <LogForm onCancel={() => setShowLogForm(false)} />
          </div>
        </div>
      )}

      {editingLog && (
        <div className="entry-form-overlay" onClick={() => setEditingLog(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <LogForm log={editingLog} onCancel={() => setEditingLog(null)} />
          </div>
        </div>
      )}

      {editingVorgang && (
        <div
          className="entry-form-overlay"
          onClick={() => setEditingVorgang(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <VorgangForm
              vorgang={editingVorgang}
              onCancel={() => setEditingVorgang(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
