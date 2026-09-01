import { FormEvent, useState } from "react";
import {
  isUnlocked,
  unlock,
} from "@/services/auth";

export function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] =
    useState(isUnlocked());

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (unlock(password)) {
      setUnlocked(true);
      setPassword("");
      setError("");
      return;
    }

    setPassword("");
    setError("Incorrect password.");
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card p-6 w-[360px]">
        <div className="text-xl font-bold mb-2">
          Assessment Engine
        </div>

        <div className="text-[13px] text-textMuted mb-4">
          Enter the password to continue.
        </div>

        <form onSubmit={submit}>
          <input
            className="input w-full mb-3"
            type="password"
            value={password}
            autoFocus
            placeholder="Password"
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          {error && (
            <div className="text-xs mb-3 text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}