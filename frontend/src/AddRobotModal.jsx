import React, { useState } from "react";

export default function AddRobotModal({ isOpen, onClose, token, onCreated }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("idle");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");

  async function handleCreate() {
    const res = await fetch("http://localhost:3000/robots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: name || undefined,
        status,
        lat: lat ? parseFloat(lat) : undefined,
        lon: lon ? parseFloat(lon) : undefined,
      }),
    });

    const robot = await res.json();

    onCreated(robot);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="card bg-base-100 p-6 w-96">
        <h2 className="text-lg font-bold mb-3">Add Robot</h2>

        <input
          className="input input-bordered w-full mb-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <select
          className="select select-bordered w-full mb-2"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="idle">idle</option>
          <option value="moving">moving</option>
        </select>

        <input
          className="input input-bordered w-full mb-2"
          placeholder="Lat (optional)"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />

        <input
          className="input input-bordered w-full mb-2"
          placeholder="Lon (optional)"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
        />

        <div className="flex justify-between mt-3">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>

          <button className="btn btn-primary" onClick={handleCreate}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
