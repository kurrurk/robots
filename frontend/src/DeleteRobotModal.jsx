import React, { useState } from "react";

export default function DeleteRobotModal({
  isOpen,
  onClose,
  robots,
  token,
  onDeleted,
}) {
  const [selectedId, setSelectedId] = useState("");

  async function handleDelete() {
    if (!selectedId) return;

    await fetch(`http://localhost:3000/robots/${selectedId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    onDeleted(selectedId);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="card bg-base-100 p-6 w-96">
        <h2 className="text-lg font-bold mb-3">Delete Robot</h2>

        <select
          className="select select-bordered w-full mb-3"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Select robot</option>
          {robots.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.id})
            </option>
          ))}
        </select>

        <div className="flex justify-between">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>

          <button className="btn btn-error" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
