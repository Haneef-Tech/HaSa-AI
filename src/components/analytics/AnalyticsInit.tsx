"use client";

import { useEffect } from "react";
import { initFirebaseAnalytics } from "@/lib/firebase/client";

/** Fire-and-forget Analytics init; never blocks rendering or breaks the app. */
export function AnalyticsInit() {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);
  return null;
}
