"use client";

import type { Session } from "@supabase/supabase-js";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { apiJson } from "./apiClient";
import { getSupabaseBrowser } from "./supabase-browser";
import type { MeResponse } from "./types";

type AdminProfile = MeResponse["data"];

type AdminAuthContextValue = {
  session: Session | null;
  profile: AdminProfile | null;
  sessionLoading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

async function fetchProfile(): Promise<AdminProfile> {
  const response = await apiJson<MeResponse>("/api/v1/me");
  return response.data;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

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
        if (active) {
          setSessionLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession ?? null);
      if (!nextSession) {
        setProfile(null);
        setProfileLoading(false);
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
      setProfile(null);
      setProfileLoading(false);
      return () => {
        active = false;
      };
    }

    setProfileLoading(true);
    fetchProfile()
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.access_token]);

  async function refreshProfile() {
    if (!session?.access_token) {
      setProfile(null);
      return;
    }

    setProfileLoading(true);
    try {
      const nextProfile = await fetchProfile();
      setProfile(nextProfile);
    } finally {
      setProfileLoading(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  return (
    <AdminAuthContext.Provider
      value={{
        session,
        profile,
        sessionLoading,
        profileLoading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}
