import React, { useState, useEffect, useCallback } from "react";
import { CommentPanelToExtensionCommunicator } from "../communicators/CommentPanelToExtensionCommunicator";
import { Comment } from "../../contracts/comment";
import { Icon } from "./Icon";
const communicator = new CommentPanelToExtensionCommunicator();

// ── Component ────────────────────────────────────────────────────────

export function CommentPanel() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    communicator.registerOnUpdate((name, entries) => {
      setFileName(name);
      setComments(entries);
    });
    communicator.sendReady();
  }, []);

  const resolve = useCallback((id: string) => {
    communicator.sendResolve(id);
  }, []);

  const del = useCallback((id: string) => {
    communicator.sendDelete(id);
  }, []);

  const goToComment = useCallback((id: string) => {
    communicator.sendGoToComment(id);
  }, []);

  return (
    <>
      <h2>
        <Icon name="comment-discussion" /> Comments — {fileName}
      </h2>

      {comments.length === 0 ? (
        <div className="empty">
          No comments yet.
          <br />
          Select text and use "Lotion: Add Comment" to add one.
        </div>
      ) : (
        comments.map((c) => {
          const date = new Date(c.createdAt);
          const ts =
            date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const isOrphan = c.line < 0;
          const lineLabel = isOrphan ? "orphan" : `Line ${c.line + 1}`;
          const anchor = c.anchorText.length > 80 ? c.anchorText.slice(0, 80) + "…" : c.anchorText;

          return (
            <div key={c.id} className={`comment-card${c.resolved ? " resolved" : ""}`}>
              <div className="comment-meta">
                {c.author && <span className="comment-author">{c.author}</span>}
                <span className="comment-line" onClick={() => goToComment(c.id)}>
                  {isOrphan && <Icon name="warning" />} {lineLabel}
                </span>
                <span className="comment-time">{ts}</span>
              </div>
              <div className="comment-anchor">"{anchor}"</div>
              <div className="comment-body">{c.body}</div>
              <div className="comment-actions">
                <button onClick={() => resolve(c.id)}>
                  {c.resolved ? (
                    <>
                      <Icon name="discard" /> Unresolve
                    </>
                  ) : (
                    <>
                      <Icon name="check" /> Resolve
                    </>
                  )}
                </button>
                <button className="danger" onClick={() => del(c.id)}>
                  <Icon name="trash" /> Delete
                </button>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
