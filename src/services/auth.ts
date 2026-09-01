const AUTH_KEY = "assessment_engine_unlocked";

const APP_PASSWORD = "Erenjeager@1234";

export function isUnlocked(): boolean {
  return localStorage.getItem(AUTH_KEY) === "true";
}

export function unlock(password: string): boolean {
  if (password !== APP_PASSWORD) {
    return false;
  }

  localStorage.setItem(AUTH_KEY, "true");
  return true;
}

export function lock(): void {
  localStorage.removeItem(AUTH_KEY);
}