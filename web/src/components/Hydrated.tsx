"use client";
import { useEffect } from "react";

/** Tells /assets/app.js that React hydration has finished, so its DOM enhancements never race hydration. */
export default function Hydrated() {
  useEffect(() => {
    (window as unknown as { __ndHydrated?: boolean }).__ndHydrated = true;
    document.dispatchEvent(new Event("nd:hydrated"));
  }, []);
  return null;
}
