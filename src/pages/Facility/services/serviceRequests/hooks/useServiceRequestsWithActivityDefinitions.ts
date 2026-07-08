import { useQueries } from "@tanstack/react-query";

import query from "@/Utils/request/query";
import activityDefinitionApi from "@/types/emr/activityDefinition/activityDefinitionApi";
import serviceRequestApi from "@/types/emr/serviceRequest/serviceRequestApi";

import { ServiceRequestWithActivityDefinition } from "@/pages/Facility/services/serviceRequests/utils/specimenGrouping";

/**
 * Fetches each service request and its full activity definition, using the
 * exact same query keys `PatientTestCard` fetches with — so this hook shares
 * TanStack Query's cache with the per-test cards instead of duplicating
 * network calls.
 */
export function useServiceRequestsWithActivityDefinitions(
  facilityId: string,
  serviceRequestIds: string[],
): { entries: ServiceRequestWithActivityDefinition[]; isLoading: boolean } {
  const requestQueries = useQueries({
    queries: serviceRequestIds.map((serviceRequestId) => ({
      queryKey: ["serviceRequest", facilityId, serviceRequestId],
      queryFn: query(serviceRequestApi.retrieveServiceRequest, {
        pathParams: { facilityId, serviceRequestId },
      }),
    })),
  });

  const slugs = requestQueries.map((q) => q.data?.activity_definition?.slug);

  const activityDefinitionQueries = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ["activityDefinition", slug],
      queryFn: query(activityDefinitionApi.retrieveActivityDefinition, {
        pathParams: {
          facilityId,
          activityDefinitionSlug: slug || "",
        },
      }),
      enabled: !!slug,
    })),
  });

  const entries: ServiceRequestWithActivityDefinition[] = serviceRequestIds.map(
    (id, index) => ({
      id,
      request: requestQueries[index]?.data,
      activityDefinition: activityDefinitionQueries[index]?.data,
    }),
  );

  const isLoading =
    requestQueries.some((q) => q.isLoading) ||
    activityDefinitionQueries.some((q) => q.isLoading);

  return { entries, isLoading };
}
