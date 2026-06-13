"use client";

import { useEffect, useState } from "react";

import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";

export type AuthState = {
  user: User | null;
  ready: boolean;
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, ready: false });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setState({ user, ready: true });
    });
  }, []);

  return state;
}
