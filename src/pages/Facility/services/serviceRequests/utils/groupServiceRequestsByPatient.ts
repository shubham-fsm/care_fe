import {
  Priority,
  ServiceRequestReadSpec,
  Status,
} from "@/types/emr/serviceRequest/serviceRequest";
import { TagConfig } from "@/types/emr/tagConfig/tagConfig";

export interface PatientRequestGroup {
  patientId: string;
  patientName: string;
  requests: ServiceRequestReadSpec[];
}

/** Highest urgency last, so `.reduce` can just keep the higher-ranked one. */
const PRIORITY_RANK: Record<Priority, number> = {
  [Priority.routine]: 0,
  [Priority.urgent]: 1,
  [Priority.asap]: 2,
  [Priority.stat]: 3,
};

/**
 * Groups a page of service requests by patient, preserving the order patients
 * first appear in (matches the API's default `-created_date` ordering).
 */
export function groupServiceRequestsByPatient(
  requests: ServiceRequestReadSpec[],
): PatientRequestGroup[] {
  const groups = new Map<string, PatientRequestGroup>();

  for (const request of requests) {
    const patientId = request.encounter.patient.id;
    let group = groups.get(patientId);
    if (!group) {
      group = {
        patientId,
        patientName: request.encounter.patient.name,
        requests: [],
      };
      groups.set(patientId, group);
    }
    group.requests.push(request);
  }

  return Array.from(groups.values());
}

/**
 * Highest-urgency priority across the group's requests. Priority isn't
 * tab-filtered (unlike status, which is always a single value server-side
 * within one page load), so a patient's tests can genuinely differ here.
 */
export function getGroupPriority(group: PatientRequestGroup): Priority {
  return group.requests.reduce<Priority>(
    (highest, request) =>
      PRIORITY_RANK[request.priority] > PRIORITY_RANK[highest]
        ? request.priority
        : highest,
    group.requests[0].priority,
  );
}

/**
 * Status is safe to read off any single member: within one worklist page
 * load every visible request already shares the same status, because
 * FilterTabs is single-select and the server query filters by exact match.
 * If that invariant ever changes (e.g. an "all statuses" tab is added) this
 * will need to become a real aggregation instead.
 */
export function getGroupStatus(group: PatientRequestGroup): Status {
  return group.requests[0].status;
}

/** Union of all distinct tags across the group's requests, dedup by id. */
export function getGroupTags(group: PatientRequestGroup): TagConfig[] {
  const seen = new Map<string, TagConfig>();
  for (const request of group.requests) {
    for (const tag of request.tags ?? []) {
      seen.set(tag.id, tag);
    }
  }
  return Array.from(seen.values());
}
