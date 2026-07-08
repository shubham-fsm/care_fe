import { useQueryClient } from "@tanstack/react-query";
import { Plus, TestTube } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import ValueSetSelect from "@/components/Questionnaire/ValueSetSelect";

import useAuthUser from "@/hooks/useAuthUser";

import { isNegative } from "@/Utils/decimal";
import { useBatchRequest } from "@/Utils/request/batch";
import query from "@/Utils/request/query";
import { Code } from "@/types/base/code/code";
import serviceRequestApi from "@/types/emr/serviceRequest/serviceRequestApi";
import {
  CollectionSpec,
  SpecimenRead,
  SpecimenStatus,
} from "@/types/emr/specimen/specimen";
import specimenApi from "@/types/emr/specimen/specimenApi";
import { SPECIMEN_DEFINITION_UNITS_CODES } from "@/types/emr/specimenDefinition/specimenDefinition";

import { SpecimenGroup } from "@/pages/Facility/services/serviceRequests/utils/specimenGrouping";

interface SpecimenCollectionGroupProps {
  facilityId: string;
  group: SpecimenGroup;
  onCollected: (specimens: SpecimenRead[]) => void;
}

type GroupCollectionState = Omit<CollectionSpec, "collector" | "procedure">;

export function SpecimenCollectionGroup({
  facilityId,
  group,
  onCollected,
}: SpecimenCollectionGroupProps) {
  const { t } = useTranslation();
  const authUser = useAuthUser();
  const queryClient = useQueryClient();

  const [isCollecting, setIsCollecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    quantityValue?: string;
    quantityUnit?: string;
  }>({});
  const [note, setNote] = useState("");
  const [collection, setCollection] = useState<GroupCollectionState>({
    collected_date_time: new Date().toISOString(),
    quantity: null,
    method: null,
    body_site: null,
    fasting_status_codeable_concept: null,
    fasting_status_duration: null,
  });

  const defaultUnit =
    group.definitions[0]?.type_tested?.container?.capacity?.unit ?? null;

  const createBatch = useBatchRequest({});
  const updateBatch = useBatchRequest({});

  // `value` is intentionally loose here (matches SpecimenForm.tsx's own
  // handleCollectionChange) since the entered quantity is a JS number before
  // submit, while QuantitySpec.value is typed as the API's string format.
  const handleCollectionChange = (
    field: keyof GroupCollectionState,
    value: any,
  ) => {
    setCollection((prev) => ({ ...prev, [field]: value }));
    if (field === "quantity") {
      setErrors((prev) => {
        const next = { ...prev };
        if (value?.value) delete next.quantityValue;
        if (value?.unit) delete next.quantityUnit;
        return next;
      });
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!authUser.id) {
      toast.error(t("specimen_collector_unavailable"));
      return;
    }

    const quantity = collection.quantity;
    const newErrors: typeof errors = {};
    if (quantity?.value && !quantity.unit && !defaultUnit) {
      newErrors.quantityUnit = t("field_required");
    }
    if (quantity?.value && isNegative(quantity.value)) {
      newErrors.quantityValue = t("invalid_quantity");
    }
    if ((quantity?.unit || defaultUnit) && !quantity?.value) {
      newErrors.quantityValue = t("field_required");
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const membersNeedingDraft = group.members.filter(
        (member) => !member.existingDraftSpecimenId,
      );

      if (membersNeedingDraft.length > 0) {
        await createBatch.mutateAsync(
          membersNeedingDraft.map((member, index) => ({
            api: specimenApi.createSpecimenFromDefinition,
            pathParams: { facilityId, serviceRequestId: member.requestId },
            referenceId: `create_${index}`,
            body: {
              specimen_definition: member.requirement.id,
              specimen: {
                status: SpecimenStatus.draft,
                specimen_type: member.requirement.type_collected,
                accession_identifier: "",
                received_time: null,
                collection: {
                  method: member.requirement.collection || null,
                  body_site: null,
                  collector: null,
                  collected_date_time: null,
                  quantity: null,
                  procedure: null,
                  fasting_status_codeable_concept: null,
                  fasting_status_duration: null,
                },
                processing: [],
                condition: [],
                note: null,
              },
            },
          })),
        );
      }

      // Re-fetch rather than trust the batch response body: the affected
      // requests' own `specimens` array is a shape we've already verified,
      // whereas the batch-create response shape for a freshly-created
      // specimen hasn't been confirmed against a live backend.
      const affectedRequestIds = Array.from(
        new Set(group.members.map((member) => member.requestId)),
      );

      const refreshedRequests = await Promise.all(
        affectedRequestIds.map((id) =>
          queryClient.fetchQuery({
            queryKey: ["serviceRequest", facilityId, id],
            queryFn: query(serviceRequestApi.retrieveServiceRequest, {
              pathParams: { facilityId, serviceRequestId: id },
            }),
            staleTime: 0,
          }),
        ),
      );
      const requestById = new Map(
        affectedRequestIds.map((id, index) => [id, refreshedRequests[index]]),
      );

      const draftSpecimensToUpdate = group.members
        .map((member) => {
          const refreshedRequest = requestById.get(member.requestId);
          return refreshedRequest?.specimens.find(
            (specimen) =>
              specimen.specimen_definition?.id === member.requirement.id &&
              specimen.status === SpecimenStatus.draft,
          );
        })
        .filter((specimen): specimen is SpecimenRead => !!specimen);

      if (draftSpecimensToUpdate.length !== group.members.length) {
        throw new Error("Could not resolve a draft specimen for every test");
      }

      await updateBatch.mutateAsync(
        draftSpecimensToUpdate.map((draft, index) => ({
          api: specimenApi.updateSpecimen,
          pathParams: { facilityId, specimenId: draft.id },
          referenceId: `update_${index}`,
          body: {
            ...draft,
            status: SpecimenStatus.available,
            note: note || null,
            collection: {
              method: draft.collection?.method ?? null,
              collected_date_time: collection.collected_date_time,
              quantity: collection.quantity
                ? {
                    ...collection.quantity,
                    unit: collection.quantity.unit ?? defaultUnit,
                  }
                : null,
              procedure: null,
              body_site: collection.body_site,
              fasting_status_codeable_concept:
                collection.fasting_status_codeable_concept,
              fasting_status_duration: collection.fasting_status_duration,
              collector: authUser.id,
            },
          },
        })),
      );

      await Promise.all(
        affectedRequestIds.map((id) =>
          queryClient.invalidateQueries({
            queryKey: ["serviceRequest", facilityId, id],
          }),
        ),
      );
      queryClient.invalidateQueries({
        queryKey: ["serviceRequests", "patient", facilityId],
      });

      toast.success(t("specimen_collected"));
      setIsCollecting(false);
      onCollected(
        draftSpecimensToUpdate.map((specimen) => ({
          ...specimen,
          status: SpecimenStatus.available,
        })),
      );
    } catch {
      toast.error(t("specimen_update_error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-none border-gray-300 rounded-lg">
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TestTube className="size-4 text-gray-600" />
            {group.typeDisplay}
          </CardTitle>
          <div className="mt-2 flex flex-wrap gap-1">
            {group.members.map((member, index) => (
              <Badge key={`${member.requestId}-${index}`} variant="secondary">
                {member.requestTitle}
              </Badge>
            ))}
          </div>
        </div>
        {!isCollecting && (
          <Button
            variant="outline_primary"
            size="sm"
            onClick={() => setIsCollecting(true)}
          >
            <Plus className="size-4" />
            {t("collect_specimen")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-4">
        <div className="text-xs text-gray-600 space-y-1">
          {group.definitions.map((definition) => (
            <div key={definition.id} className="flex flex-wrap gap-x-2">
              <span className="font-medium">{definition.title}:</span>
              <span>
                {definition.type_tested?.container?.cap?.display ?? t("na")}
              </span>
              {definition.collection?.display && (
                <span>({definition.collection.display})</span>
              )}
            </div>
          ))}
        </div>

        {isCollecting && (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 border-t pt-4 bg-gray-50 -mx-4 -mb-2 px-4 pb-4"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-700">
                  {t("collection_date_time")}
                </Label>
                <Input
                  className="h-9"
                  type="datetime-local"
                  value={collection.collected_date_time?.split(".")[0] || ""}
                  onChange={(e) =>
                    handleCollectionChange(
                      "collected_date_time",
                      e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-sm text-gray-700">{t("quantity")}</Label>
                <div className="flex gap-2">
                  <div className="flex-1 max-w-36">
                    <Input
                      pattern="[0-9]*"
                      type="number"
                      placeholder={t("value")}
                      className="h-9"
                      min={1}
                      step="any"
                      value={collection.quantity?.value ?? ""}
                      onChange={(e) =>
                        handleCollectionChange("quantity", {
                          ...(collection.quantity ?? {}),
                          value: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                          unit: collection.quantity?.unit,
                        })
                      }
                    />
                    {errors.quantityValue && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.quantityValue}
                      </p>
                    )}
                  </div>
                  <div className="flex-1">
                    <Select
                      value={
                        collection.quantity?.unit?.code ?? defaultUnit?.code
                      }
                      onValueChange={(code) => {
                        const selectedUnit =
                          SPECIMEN_DEFINITION_UNITS_CODES.find(
                            (u) => u.code === code,
                          );
                        if (selectedUnit) {
                          handleCollectionChange("quantity", {
                            value: collection.quantity?.value ?? null,
                            unit: selectedUnit,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={t("unit")} />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIMEN_DEFINITION_UNITS_CODES.map((unit) => (
                          <SelectItem key={unit.code} value={unit.code}>
                            {unit.display}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.quantityUnit && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.quantityUnit}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm text-gray-700">{t("body_site")}</Label>
              <ValueSetSelect
                system="system-body-site"
                placeholder={t("select_body_site")}
                onSelect={(code: Code | null) =>
                  handleCollectionChange("body_site", code)
                }
                value={collection.body_site}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="col-span-1 md:col-span-4">
                <Label className="text-sm text-gray-700">
                  {t("fasting_status")}
                </Label>
                <ValueSetSelect
                  system="system-fasting-status-code"
                  placeholder={t("select_status")}
                  onSelect={(code: Code | null) =>
                    handleCollectionChange(
                      "fasting_status_codeable_concept",
                      code,
                    )
                  }
                  value={collection.fasting_status_codeable_concept}
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label className="text-sm text-gray-700">
                  {t("fasting_duration")}
                </Label>
                <Input
                  type="number"
                  placeholder={t("fasting_duration_placeholder")}
                  value={collection.fasting_status_duration?.value ?? ""}
                  onChange={(e) =>
                    handleCollectionChange("fasting_status_duration", {
                      ...(collection.fasting_status_duration ?? {}),
                      value: e.target.value ? parseFloat(e.target.value) : null,
                      unit: collection.fasting_status_duration?.unit ?? {
                        code: "h",
                        display: "hour",
                        system: "http://unitsofmeasure.org",
                      },
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-gray-700">{t("notes")}</Label>
              <Textarea
                placeholder={t("notes_placeholder")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCollecting(false)}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("collecting") : t("collect")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
