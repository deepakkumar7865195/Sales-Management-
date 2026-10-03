"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface UseRealtimeOptions {
  table: string;
  filter?: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  onChange?: () => void;
}

export function useRealtime({
  table,
  filter,
  event = "INSERT",
  onChange,
}: UseRealtimeOptions) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const stableOnChange = useCallback(() => {
    onChangeRef.current?.();
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`realtime-${table}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event,
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        () => stableOnChange()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, stableOnChange]);
}