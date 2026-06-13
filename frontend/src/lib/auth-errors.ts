// Friendly copy for the Firebase Auth error codes the user can hit
// from /register and /login.
const COPY: Record<string, string> = {
  "auth/email-already-in-use":
    "An account with that email already exists. Try logging in instead.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/weak-password": "Password must be at least 8 characters.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/user-not-found": "No account found for that email.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/too-many-requests":
    "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed":
    "Couldn't reach Firebase. Check your connection and try again.",
};

export function humanizeAuthError(code: string): string {
  return COPY[code] ?? "Something went wrong. Please try again.";
}
