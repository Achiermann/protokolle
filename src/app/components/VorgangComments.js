"use client";

import { useState } from "react";
import { Pencil, Trash } from "lucide-react";
import toast from "react-hot-toast";
import { useChangelogStore } from "../stores/useChangelogStore";
import { useAuthStore } from "../stores/useAuthStore";

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

// Thread under an unfolded Vorgang: "Name - dd/mm/yy" above the text, oldest
// first, with an input below (Enter sends, Shift/Alt+Enter adds a line).
// Authors can edit and delete their own comments.
export default function VorgangComments({ vorgang, comments }) {
  // *** VARIABLES ***
  const addComment = useChangelogStore((state) => state.addComment);
  const updateComment = useChangelogStore((state) => state.updateComment);
  const deleteComment = useChangelogStore((state) => state.deleteComment);
  const userId = useAuthStore((state) => state.user?.id);

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

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
            return (
              <li key={comment.id} className="changelog-comments-item">
                <div className="changelog-comments-meta">
                  <span className="changelog-comments-author">
                    {comment.created_by_name || "?"}
                  </span>
                  <span className="changelog-comments-date">
                    - {formatCommentDate(comment.created_at)}
                  </span>
                  {isOwn && editingId !== comment.id && (
                    <div className="entry-list-item-actions changelog-comments-actions">
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
