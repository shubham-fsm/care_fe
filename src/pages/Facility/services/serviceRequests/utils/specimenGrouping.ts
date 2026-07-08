import { ActivityDefinitionReadSpec } from "@/types/emr/activityDefinition/activityDefinition";
import { ServiceRequestReadSpec } from "@/types/emr/serviceRequest/serviceRequest";
import { SpecimenStatus } from "@/types/emr/specimen/specimen";
import { SpecimenDefinitionRead } from "@/types/emr/specimenDefinition/specimenDefinition";

export interface ServiceRequestWithActivityDefinition {
  id: string;
  request?: ServiceRequestReadSpec;
  activityDefinition?: ActivityDefinitionReadSpec;
}

export interface PendingSpecimenMember {
  requestId: string;
  requestTitle: string;
  requirement: SpecimenDefinitionRead;
  existingDraftSpecimenId?: string;
}

export interface SpecimenGroup {
  key: string;
  typeDisplay: string;
  definitions: SpecimenDefinitionRead[];
  members: PendingSpecimenMember[];
}

/**
 * Buckets every not-yet-collected (service request, specimen requirement) pair
 * across the given entries by specimen type (e.g. "Blood", "Urine"), so a
 * single physical draw covering several tests can be collected in one action.
 *
 * A requirement counts as already collected only when an `available` specimen
 * exists for it — a `draft` specimen (QR generated, not yet drawn) is still
 * pending, and its id is carried on the member so collection can reuse it
 * instead of creating a duplicate draft.
 */
export function groupPendingSpecimenRequirements(
  entries: ServiceRequestWithActivityDefinition[],
): SpecimenGroup[] {
  const groups = new Map<string, SpecimenGroup>();

  for (const { request, activityDefinition } of entries) {
    if (!request || !activityDefinition) continue;

    const specimenRequirements = activityDefinition.specimen_requirements ?? [];

    for (const requirement of specimenRequirements) {
      const matchingSpecimens = request.specimens.filter(
        (specimen) => specimen.specimen_definition?.id === requirement.id,
      );
      const isAlreadyCollected = matchingSpecimens.some(
        (specimen) => specimen.status === SpecimenStatus.available,
      );
      if (isAlreadyCollected) continue;

      const existingDraft = matchingSpecimens.find(
        (specimen) => specimen.status === SpecimenStatus.draft,
      );

      const key =
        requirement.type_collected?.code ||
        requirement.type_collected?.display ||
        requirement.id;
      const typeDisplay =
        requirement.type_collected?.display || requirement.title;

      let group = groups.get(key);
      if (!group) {
        group = { key, typeDisplay, definitions: [], members: [] };
        groups.set(key, group);
      }
      if (!group.definitions.some((d) => d.id === requirement.id)) {
        group.definitions.push(requirement);
      }
      group.members.push({
        requestId: request.id,
        requestTitle: request.title,
        requirement,
        existingDraftSpecimenId: existingDraft?.id,
      });
    }
  }

  return Array.from(groups.values());
}
