"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash } from "lucide-react";
import toast from "react-hot-toast";
import { useChangelogStore, getUnseen } from "../stores/useChangelogStore";
import { useAuthStore } from "../stores/useAuthStore";
import VorgangComments, { formatCommentDate } from "./VorgangComments";
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

export default function Changelog() {
  // *** VARIABLES ***
  const vorgaenge = useChangelogStore((state) => state.vorgaenge);
  const comments = useChangelogStore((state) => state.comments);
  const loading = useChangelogStore((state) => state.loading);
  const ensureChangelog = useChangelogStore((state) => state.ensureChangelog);
  const deleteVorgang = useChangelogStore((state) => state.deleteVorgang);
  const seenSince = useChangelogStore((state) => state.seenSince);
  const seenIds = useChangelogStore((state) => state.seenIds);
  const unreadIds = useChangelogStore((state) => state.unreadIds);
  const markSeen = useChangelogStore((state) => state.markSeen);
  const markUnread = useChangelogStore((state) => state.markUnread);
  const userId = useAuthStore((state) => state.user?.id);

  // { topic } while the "Neuer Vorgang" form is open (topic preset from a
  // Thema's "+" button, "" from the top button).
  const [creatingVorgang, setCreatingVorgang] = useState(null);
  const [editingVorgang, setEditingVorgang] = useState(null);
  // Themen start open, Vorgänge closed; each set holds the exceptions.
  const [collapsedTopics, setCollapsedTopics] = useState(new Set());
  const [openVorgaenge, setOpenVorgaenge] = useState(new Set());
  const [search, setSearch] = useState("");
  // Comments marked unread by hand while their Vorgang is open: kept unread
  // (not auto-seen) until that Vorgang is unfolded again.
  const [heldUnread, setHeldUnread] = useState(new Set());

  const vorgaengeById = useMemo(
    () => new Map(vorgaenge.map((v) => [v.id, v])),
    [vorgaenge],
  );

  // Comments per Vorgang, oldest first (the API already sorts them).
  const commentsByVorgang = useMemo(() => {
    const map = new Map();
    for (const comment of comments) {
      if (!map.has(comment.vorgang_id)) map.set(comment.vorgang_id, []);
      map.get(comment.vorgang_id).push(comment);
    }
    return map;
  }, [comments]);

  // Overview rows for unread comments, newest first.
  const unseenComments = useMemo(
    () =>
      getUnseen({ comments, seenSince, seenIds, unreadIds }, userId)
        .filter((comment) => vorgaengeById.has(comment.vorgang_id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [comments, seenSince, seenIds, unreadIds, userId, vorgaengeById],
  );
  const unseenIds = useMemo(
    () => new Set(unseenComments.map((comment) => comment.id)),
    [unseenComments],
  );

  // Thema → Vorgänge. Themen and Vorgänge alphabetical, "Ohne Thema" last.
  const groups = useMemo(() => {
    const byTopic = new Map();
    for (const vorgang of vorgaenge) {
      const key = vorgang.topic || "";
      if (!byTopic.has(key)) byTopic.set(key, []);
      byTopic.get(key).push(vorgang);
    }
    return Array.from(byTopic.entries())
      .map(([topic, items]) => ({
        topic,
        items: items.sort((a, b) => a.name.localeCompare(b.name, "de")),
      }))
      .sort((a, b) => {
        if (!a.topic) return 1;
        if (!b.topic) return -1;
        return a.topic.localeCompare(b.topic, "de");
      });
  }, [vorgaenge]);

  // Search across Thema, Vorgang, comments and names; matching Vorgänge show
  // their whole thread, unfolded.
  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;
  const visibleGroups = useMemo(() => {
    if (!query) return groups;
    const hit = (text) => (text || "").toLowerCase().includes(query);
    return groups
      .map((group) => ({
        topic: group.topic,
        items: group.items.filter(
          (vorgang) =>
            hit(vorgang.name) ||
            hit(group.topic) ||
            (commentsByVorgang.get(vorgang.id) || []).some(
              (c) => hit(c.body) || hit(c.created_by_name),
            ),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query, commentsByVorgang]);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    ensureChangelog();
  }, [ensureChangelog]);

  // A comment counts as seen once its Vorgang (and Thema) is unfolded by
  // hand; search-unfolding doesn't count, nor do comments held unread.
  useEffect(() => {
    const ids = unseenComments
      .filter((comment) => {
        const vorgang = vorgaengeById.get(comment.vorgang_id);
        return (
          !heldUnread.has(comment.id) &&
          openVorgaenge.has(comment.vorgang_id) &&
          !collapsedTopics.has(vorgang.topic || "")
        );
      })
      .map((comment) => comment.id);
    if (ids.length > 0) markSeen(ids);
  }, [
    unseenComments,
    heldUnread,
    openVorgaenge,
    collapsedTopics,
    vorgaengeById,
    markSeen,
  ]);

  // Unfolding a Vorgang again lets its held-unread comments become seen.
  const releaseHeldUnread = (vorgangId) => {
    setHeldUnread((prev) => {
      const next = new Set(
        [...prev].filter(
          (id) =>
            comments.find((comment) => comment.id === id)?.vorgang_id !==
            vorgangId,
        ),
      );
      return next.size === prev.size ? prev : next;
    });
  };

  const handleToggleVorgang = (vorgangId) => {
    if (!openVorgaenge.has(vorgangId)) releaseHeldUnread(vorgangId);
    toggleInSet(setOpenVorgaenge, vorgangId);
  };

  const handleMarkUnread = (comment) => {
    setHeldUnread((prev) => new Set(prev).add(comment.id));
    markUnread([comment.id]);
  };

  const toggleInSet = (setter, key) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Unfold the path to a Vorgang and scroll to it once rendered. Used by the
  // overview (which thereby marks the comments seen) and after creating one.
  const openVorgang = (vorgang) => {
    setSearch("");
    releaseHeldUnread(vorgang.id);
    setCollapsedTopics((prev) => {
      const next = new Set(prev);
      next.delete(vorgang.topic || "");
      return next;
    });
    setOpenVorgaenge((prev) => new Set(prev).add(vorgang.id));
    setTimeout(() => {
      document
        .getElementById(`changelog-vorgang-${vorgang.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleMarkAllSeen = () => {
    markSeen(unseenComments.map((comment) => comment.id));
  };

  const handleDeleteVorgang = async (vorgang, commentCount) => {
    const message =
      commentCount > 0
        ? `Vorgang "${vorgang.name}" mit ${commentCount} Kommentar${commentCount === 1 ? "" : "en"} löschen?`
        : `Vorgang "${vorgang.name}" löschen?`;
    if (!confirm(message)) return;
    try {
      await deleteVorgang(vorgang.id);
      toast.success("Vorgang gelöscht");
    } catch (error) {
      toast.error("Vorgang konnte nicht gelöscht werden");
    }
  };

  return (
    <div className="changelog">
      <div className="changelog-header">
        <h2 className="section-title">Changelog</h2>
      </div>

      <button
        type="button"
        className="entry-list-new-button"
        onClick={() => setCreatingVorgang({ topic: "" })}
      >
        <Plus size={18} />
        Neuer Vorgang
      </button>

      {unseenComments.length > 0 && (
        <div className="changelog-unseen">
          <div className="changelog-unseen-header">
            <h3>Ungelesen ({unseenComments.length})</h3>
            <button
              type="button"
              className="secondary"
              onClick={handleMarkAllSeen}
            >
              Alle als gelesen markieren
            </button>
          </div>
          <ul className="changelog-unseen-list">
            {unseenComments.map((comment) => {
              const vorgang = vorgaengeById.get(comment.vorgang_id);
              return (
                <li
                  key={comment.id}
                  className="changelog-unseen-item"
                  onClick={() => openVorgang(vorgang)}
                >
                  <span className="changelog-unseen-path">
                    {vorgang.topic || NO_TOPIC} › {vorgang.name}
                  </span>
                  <span className="changelog-unseen-line">
                    <span className="changelog-comments-date">
                      {formatCommentDate(comment.created_at)}
                    </span>
                    <span className="changelog-comments-author">
                      {comment.created_by_name || "?"}:
                    </span>
                    <span className="changelog-unseen-text">
                      {comment.body}
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
          <p>Noch keine Vorgänge.</p>
        </div>
      )}

      {!loading && groups.length > 0 && visibleGroups.length === 0 && (
        <div className="changelog-empty">
          <p>Keine Vorgänge entsprechen deiner Suche.</p>
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
                <div
                  className="entry-list-item-actions changelog-topic-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setCreatingVorgang({ topic: group.topic })}
                    title="Neuer Vorgang in diesem Thema"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {isTopicOpen &&
                group.items.map((vorgang) => {
                  const vorgangComments =
                    commentsByVorgang.get(vorgang.id) || [];
                  const lastComment =
                    vorgangComments[vorgangComments.length - 1];
                  const isVorgangOpen =
                    isSearching || openVorgaenge.has(vorgang.id);
                  return (
                    <div
                      key={vorgang.id}
                      id={`changelog-vorgang-${vorgang.id}`}
                      className="changelog-vorgang"
                    >
                      <div
                        className="changelog-vorgang-bar"
                        onClick={() => handleToggleVorgang(vorgang.id)}
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
                          {vorgangComments.length}{" "}
                          {vorgangComments.length === 1
                            ? "Kommentar"
                            : "Kommentare"}
                          {lastComment &&
                            ` · zuletzt ${formatCommentDate(lastComment.created_at)}`}
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
                              handleDeleteVorgang(
                                vorgang,
                                vorgangComments.length,
                              )
                            }
                            title="Vorgang löschen"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </div>

                      {isVorgangOpen && (
                        <VorgangComments
                          vorgang={vorgang}
                          comments={vorgangComments}
                          unseenIds={unseenIds}
                          onMarkUnread={handleMarkUnread}
                        />
                      )}
                    </div>
                  );
                })}
            </section>
          );
        })}

      {creatingVorgang && (
        <div
          className="entry-form-overlay"
          onClick={() => setCreatingVorgang(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <VorgangForm
              initialTopic={creatingVorgang.topic}
              onCancel={() => setCreatingVorgang(null)}
              onCreated={openVorgang}
            />
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
