"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Pencil, SmilePlus, Trash } from "lucide-react";
import toast from "react-hot-toast";
import { useChangelogStore } from "../stores/useChangelogStore";
import { useAuthStore } from "../stores/useAuthStore";
import { REACTION_EMOJIS } from "@/lib/changelogReactions";

// Comment timestamps are full ISO datetimes; shown as a local dd/mm/yy date.
export const formatCommentDate = (isoDateTime) => {
  const date = new Date(isoDateTime);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(2);
  return `${day}/${month}/${year}`;
};

// Textarea height in rows: one per line of text, capped (CSS field-sizing
// additionally grows it for soft-wrapped lines where supported).
const MAX_ROWS = 8;
const rowsFor = (text) => Math.min(MAX_ROWS, text.split("\n").length);

// Avatar placeholder colours; each author keeps one, picked by hashing their id.
const AVATAR_COLORS = [
  "#9b2fae",
  "#2f6fd6",
  "#1f9d74",
  "#d9822b",
  "#c2366b",
  "#5a50c8",
  "#0f8fa8",
  "#7a8a1f",
];
const avatarColorFor = (key = "") => {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Thread under an unfolded Vorgang: "Name - dd/mm/yy" above the text, oldest
// first, with an input below (Enter sends, Shift/Alt+Enter adds a line).
// Authors can edit and delete their own comments; any comment can be marked
// unread (`onMarkUnread`) unless it already is (`unseenIds`). Everyone can
// react with one emoji per comment (WhatsApp-style): picked from the smiley
// button, shown as chips with counts below the text; clicking a chip sets or
// removes one's own reaction, hovering it names who reacted.
export default function VorgangComments({
  vorgang,
  comments,
  unseenIds,
  onMarkUnread,
}) {
  // *** VARIABLES ***
  const addComment = useChangelogStore((state) => state.addComment);
  const updateComment = useChangelogStore((state) => state.updateComment);
  const deleteComment = useChangelogStore((state) => state.deleteComment);
  const reactions = useChangelogStore((state) => state.reactions);
  const setReaction = useChangelogStore((state) => state.setReaction);
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  // Id of the comment whose emoji picker is open.
  const [pickerFor, setPickerFor] = useState(null);
  const pickerRef = useRef(null);

  // Per comment: chips in picker order, each { emoji, names, mine }.
  const chipsByComment = useMemo(() => {
    const map = new Map();
    for (const reaction of reactions) {
      if (!map.has(reaction.comment_id)) map.set(reaction.comment_id, []);
      map.get(reaction.comment_id).push(reaction);
    }
    const chips = new Map();
    for (const [commentId, list] of map) {
      chips.set(
        commentId,
        REACTION_EMOJIS.map((emoji) => {
          const matching = list.filter((r) => r.emoji === emoji);
          return {
            emoji,
            names: matching.map((r) => r.user_name || "?"),
            mine: matching.some((r) => r.user_id === userId),
          };
        }).filter((chip) => chip.names.length > 0),
      );
    }
    return chips;
  }, [reactions, userId]);

  // Close the picker on a click outside it or Escape.
  useEffect(() => {
    if (!pickerFor) return;
    const handlePointer = (e) => {
      if (!pickerRef.current?.contains(e.target)) setPickerFor(null);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setPickerFor(null);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [pickerFor]);

  // *** FUNCTIONS/HANDLERS ***
  const handleSend = async () => {
    if (!draft.trim() || isSending) return;
    setIsSending(true);
    try {
      await addComment({ vorgang_id: vorgang.id, body: draft.trim() });
      setDraft("");
    } catch (error) {
      toast.error("Kommentar konnte nicht gespeichert werden");
    } finally {
      setIsSending(false);
    }
  };

  // Same emoji as one's current reaction removes it, another replaces it.
  const handleReact = async (comment, emoji) => {
    setPickerFor(null);
    if (!user) return;
    const current = reactions.find(
      (r) => r.comment_id === comment.id && r.user_id === userId,
    )?.emoji;
    try {
      await setReaction(comment.id, current === emoji ? null : emoji, user);
    } catch (error) {
      toast.error("Reaktion konnte nicht gespeichert werden");
    }
  };

  const handleStartEdit = (comment) => {
    setEditingId(comment.id);
    setEditDraft(comment.body);
  };

  const handleSaveEdit = async () => {
    if (!editDraft.trim()) return;
    try {
      await updateComment(editingId, editDraft.trim());
      setEditingId(null);
    } catch (error) {
      toast.error("Kommentar konnte nicht aktualisiert werden");
    }
  };

  const handleDelete = async (comment) => {
    if (!confirm("Kommentar löschen?")) return;
    try {
      await deleteComment(comment.id);
    } catch (error) {
      toast.error("Kommentar konnte nicht gelöscht werden");
    }
  };

  // Enter submits, Shift+Enter or Alt+Enter adds a line break; the IME
  // check keeps composing (e.g. accents) from sending. Shift+Enter breaks
  // natively in a textarea, Alt+Enter doesn't, so that one is inserted here.
  const handleKeyDown = (e, setValue, onSubmit, onCancel) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && e.altKey) {
      e.preventDefault();
      const field = e.target;
      const { selectionStart, selectionEnd, value } = field;
      setValue(
        value.slice(0, selectionStart) + "\n" + value.slice(selectionEnd),
      );
      requestAnimationFrame(() =>
        field.setSelectionRange(selectionStart + 1, selectionStart + 1),
      );
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    } else if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  };

  return (
    <div className="changelog-comments">
      {comments.length > 0 && (
        <ul className="changelog-comments-list">
          {comments.map((comment) => {
            const isOwn = userId && comment.created_by === userId;
            const chips = chipsByComment.get(comment.id) || [];
            const isPickerOpen = pickerFor === comment.id;
            return (
              <li key={comment.id} className="changelog-comments-item">
                <div
                  className="changelog-comments-avatar"
                  style={{
                    backgroundColor: avatarColorFor(
                      comment.created_by || comment.created_by_name,
                    ),
                  }}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 36 36">
                    <circle cx="18" cy="14" r="7" />
                    <ellipse cx="18" cy="34" rx="13" ry="10" />
                  </svg>
                </div>
                <div className="changelog-comments-body">
                  <div className="changelog-comments-meta">
                    <span className="changelog-comments-author">
                      {comment.created_by_name || "?"}
                    </span>
                    <span className="changelog-comments-date">
                      - {formatCommentDate(comment.created_at)}
                    </span>
                    {editingId !== comment.id && (
                      <div
                        className={`entry-list-item-actions changelog-comments-actions${isPickerOpen ? " is-open" : ""}`}
                      >
                        <div
                          className="changelog-reaction-anchor"
                          ref={isPickerOpen ? pickerRef : null}
                        >
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              setPickerFor(isPickerOpen ? null : comment.id)
                            }
                            title="Reagieren"
                            aria-expanded={isPickerOpen}
                          >
                            <SmilePlus size={14} />
                          </button>
                          {isPickerOpen && (
                            <div
                              className="changelog-reaction-picker"
                              role="menu"
                            >
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  role="menuitem"
                                  className={
                                    chips.some(
                                      (c) => c.emoji === emoji && c.mine,
                                    )
                                      ? "is-mine"
                                      : ""
                                  }
                                  onClick={() => handleReact(comment, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {!unseenIds.has(comment.id) && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => onMarkUnread(comment)}
                            title="Als ungelesen markieren"
                          >
                            <Mail size={14} />
                          </button>
                        )}
                        {isOwn && (
                          <>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => handleStartEdit(comment)}
                              title="Kommentar bearbeiten"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => handleDelete(comment)}
                              title="Kommentar löschen"
                            >
                              <Trash size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {editingId === comment.id ? (
                    <textarea
                      className="changelog-comments-edit-input"
                      rows={rowsFor(editDraft)}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) =>
                        handleKeyDown(e, setEditDraft, handleSaveEdit, () =>
                          setEditingId(null),
                        )
                      }
                      onBlur={() => setEditingId(null)}
                      autoFocus
                    />
                  ) : (
                    <p className="changelog-comments-text">{comment.body}</p>
                  )}
                  {chips.length > 0 && (
                    <div className="changelog-reactions">
                      {chips.map((chip) => (
                        <button
                          key={chip.emoji}
                          type="button"
                          className={`changelog-reaction-chip${chip.mine ? " is-mine" : ""}`}
                          onClick={() => handleReact(comment, chip.emoji)}
                          title={chip.names.join(", ")}
                        >
                          <span>{chip.emoji}</span>
                          <span className="changelog-reaction-count">
                            {chip.names.length}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="changelog-comments-new">
        <textarea
          rows={rowsFor(draft)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, setDraft, handleSend)}
          placeholder="Kommentar schreiben... (Shift+Enter für neue Zeile)"
          disabled={isSending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !draft.trim()}
        >
          Senden
        </button>
      </div>
    </div>
  );
}
