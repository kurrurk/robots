import React, { useState } from "react";

export default function AuthForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  async function handleSubmit() {
    const url = isLogin
      ? "http://localhost:3000/auth/login"
      : "http://localhost:3000/auth/register";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      alert("Error");
      return;
    }

    // если это login → получаем токен
    if (isLogin) {
      const data = await res.json();
      onLogin(data.token);
    } else {
      alert("Registered! Now login.");
      setIsLogin(true);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-base-300">
      <div className="card w-96 bg-base-100 shadow-2xl border border-base-300">
        <div className="card-body">
          <h2 className="text-2xl font-bold text-primary text-center mb-4">
            {isLogin ? "Login" : "Register"}
          </h2>

          <input
            type="email"
            placeholder="Email"
            className="input input-bordered w-full bg-base-200 focus:bg-base-100 focus:outline-none focus:ring-2 focus:ring-primary"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="input input-bordered w-full mt-3 bg-base-200 focus:bg-base-100 focus:outline-none focus:ring-2 focus:ring-primary"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            className="btn btn-primary mt-5 w-full shadow-lg hover:scale-[1.02] transition"
            onClick={handleSubmit}
          >
            {isLogin ? "Login" : "Create Account"}
          </button>

          <button
            className="btn btn-ghost mt-2 text-sm"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "No account? Register" : "Back to login"}
          </button>
        </div>
      </div>
    </div>
  );
}
