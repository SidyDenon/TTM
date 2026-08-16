export const TERMINAL_MISSION_STATUSES = new Set([
  "terminee",
  "annulee",
  "annulee_client",
  "annulee_admin",
]);

export const ACTIVE_MISSION_STATUSES = [
  "assignee",
  "acceptee",
  "en_route",
  "sur_place",
  "remorquage",
];

export const CLIENT_CANCELLABLE_STATUSES = [
  "en_attente",
  "publiee",
  "assignee",
  "acceptee",
];

export const ADMIN_ASSIGNABLE_STATUSES = ["en_attente", "publiee", "assignee"];

export function isTowingMission(mission = {}) {
  return String(mission.service || mission.type || "")
    .toLowerCase()
    .includes("remorqu");
}

export function canOperatorTransition(mission, nextStatus) {
  const previous = String(mission?.status || "");
  const flow = isTowingMission(mission)
    ? {
        en_route: ["assignee", "acceptee"],
        sur_place: ["en_route"],
        remorquage: ["sur_place"],
        terminee: ["remorquage"],
      }
    : {
        en_route: ["assignee", "acceptee"],
        sur_place: ["en_route"],
        terminee: ["sur_place"],
      };
  return Array.isArray(flow[nextStatus]) && flow[nextStatus].includes(previous);
}

export function canAdminTransition(mission, nextStatus) {
  const previous = String(mission?.status || "");
  if (nextStatus === "annulee_admin") {
    return !TERMINAL_MISSION_STATUSES.has(previous);
  }
  if (nextStatus === "terminee") {
    return canOperatorTransition(mission, nextStatus);
  }
  return false;
}
