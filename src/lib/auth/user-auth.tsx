"use client";

import type { Session } from "@supabase/supabase-js";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { getSupabaseBrowser } from "../supabase/browser";

type AuthUserProfile = {
  id: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "banned";
};

type MeResponse = {
  data: AuthUserProfile;
};

type UserAuthContextValue = {
  session: Session | null;
  user: AuthUserProfile | null;
  sessionLoading: boolean;
  userLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const UserAuthContext = createContext<UserAuthContextValue | null>(null);

async function fetchMe(): Promise<AuthUserProfile> {
  const supabase = getSupabaseBrowser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No active session");
  }

  const response = await fetch("/api/v1/me", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as MeResponse | null;
  if (!response.ok || !body?.data) {
    throw new Error("Failed to load current user");
  }

  return body.data;
}

export function UserAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowser();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession ?? null);
      if (!nextSession) {
        setUser(null);
        setUserLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session?.access_token) {
      setUser(null);
      setUserLoading(false);
      return () => {
        active = false;
      };
    }

    setUserLoading(true);
    fetchMe()
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setUserLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.access_token]);

  async function refreshUser() {
    if (!session?.access_token) {
      setUser(null);
      return;
    }
    setUserLoading(true);
    try {
      setUser(await fetchMe());
    } finally {
      setUserLoading(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }

  async function getAccessToken() {
    const supabase = getSupabaseBrowser();
    const {
      data: { session: nextSession },
    } = await supabase.auth.getSession();
    return nextSession?.access_token ?? null;
  }

  return (
    <UserAuthContext.Provider
      value={{
        session,
        user,
        sessionLoading,
        userLoading,
        isAuthenticated: Boolean(session?.access_token),
        refreshUser,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error("useUserAuth must be used within UserAuthProvider");
  }
  return context;
}

export type { AuthUserProfile };

