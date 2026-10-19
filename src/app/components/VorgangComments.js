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

// Thread under an unfolded Vorgang: "Name - dd/mm/yy" above the text, oldest
// first, with a one-line input below (Enter sends). Authors can edit and
// delete their own comments.
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

  // Enter submits; the IME check keeps composing (e.g. accents) from sending.
  const handleKeyDown = (e, onSubmit, onCancel) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
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
                  <input
                    type="text"
                    className="changelog-comments-edit-input"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) =>
                      handleKeyDown(e, handleSaveEdit, () => setEditingId(null))
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
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, handleSend)}
          placeholder="Kommentar schreiben..."
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
