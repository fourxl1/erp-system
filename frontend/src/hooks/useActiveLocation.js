import { useEffect, useState } from "react";
import { readStoredUser } from "../utils/auth";

export const LOCATION_CONTEXT_EVENT = "inventory-location-context-changed";

function resolveActiveLocationId() {
  const stored = localStorage.getItem("inventory-active-location-id");

  if (stored && /^\d+$/.test(String(stored))) {
    return String(stored);
  }

  const user = readStoredUser();
  return user?.location_id ? String(user.location_id) : "";
}

export function useActiveLocationId() {
  const [activeLocationId, setActiveLocationId] = useState(resolveActiveLocationId);

  useEffect(() => {
    function handleLocationContextChange() {
      setActiveLocationId(resolveActiveLocationId());
    }

    window.addEventListener(LOCATION_CONTEXT_EVENT, handleLocationContextChange);
    return () => window.removeEventListener(LOCATION_CONTEXT_EVENT, handleLocationContextChange);
  }, []);

  return activeLocationId;
}

