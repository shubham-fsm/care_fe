import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import RadioInput from "@/components/ui/RadioInput";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  ScheduleResourceFormState,
  ScheduleResourceSelector,
} from "@/components/Schedule/ResourceSelector";

import {
  AppointmentStatus,
  SchedulableResourceType,
} from "@/types/scheduling/schedule";
import scheduleApis from "@/types/scheduling/scheduleApi";
import {
  renderTokenNumber,
  TokenRead,
  TokenRetrieve,
  TokenStatus,
} from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import tokenCategoryApi from "@/types/tokens/tokenCategory/tokenCategoryApi";
import tokenQueueApi from "@/types/tokens/tokenQueue/tokenQueueApi";
import query, { callApi } from "@/Utils/request/query";
import { dateQueryString } from "@/Utils/utils";

/** Tokens that can still be moved: not yet with the doctor, not closed. */
export function canChangeTokenQueue(token: TokenRead) {
  return [TokenStatus.CREATED, TokenStatus.UNFULFILLED].includes(token.status);
}

function resourceName(resource: ScheduleResourceFormState) {
  const r = resource.resource;
  if (!r) return "";
  if (resource.resource_type === SchedulableResourceType.Practitioner) {
    const user = r as { first_name?: string; last_name?: string };
    return [user.first_name, user.last_name].filter(Boolean).join(" ");
  }
  return (r as { name?: string }).name ?? "";
}

interface Props {
  facilityId: string;
  queueId: string;
  tokenId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new token (and the new appointment, if any). */
  onMoved?: (token: TokenRead, appointmentId?: string) => void;
}

/**
 * Registration put the patient in the wrong queue (wrong doctor / service)
 * or category: move them. The token is replaced by a new one in the right
 * queue and the wrong one is cancelled, so it leaves the wrong doctor's
 * list and TV. With an appointment, the appointment moves to the right
 * doctor / service too (today's next open slot), keeping its check-in.
 */
export function ChangeTokenQueueSheet({
  facilityId,
  queueId,
  tokenId,
  open,
  onOpenChange,
  onMoved,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pickedResource, setSelectedResource] =
    useState<ScheduleResourceFormState | null>(null);
  const [pickedCategory, setCategoryId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const { data: token } = useQuery({
    queryKey: ["token", tokenId],
    queryFn: query(tokenApi.get, {
      pathParams: { facility_id: facilityId, queue_id: queueId, id: tokenId },
    }),
    enabled: open,
  });

  // Start from where the patient is now
  const selectedResource: ScheduleResourceFormState =
    pickedResource ??
    (token?.resource
      ? ({
          resource: token.resource,
          resource_type: token.resource_type,
        } as ScheduleResourceFormState)
      : {
          resource: null,
          resource_type: SchedulableResourceType.Practitioner,
        });

  const { data: categories } = useQuery({
    queryKey: ["tokenCategories", facilityId, selectedResource.resource_type],
    queryFn: query(tokenCategoryApi.list, {
      pathParams: { facility_id: facilityId },
      queryParams: {
        resource_type: selectedResource.resource_type,
        limit: 100,
      },
    }),
    enabled: open,
  });

  // A category of another resource type cannot be kept
  const inList = (id?: string | null) =>
    !!id && !!categories?.results.some((c) => c.id === id);
  const categoryId =
    (inList(pickedCategory) && pickedCategory) ||
    (inList(token?.category.id) && token?.category.id) ||
    categories?.results.find((c) => c.default)?.id ||
    categories?.results[0]?.id ||
    "";

  const newResourceId = selectedResource.resource?.id;
  const unchanged =
    !!token &&
    newResourceId === token.resource?.id &&
    categoryId === token.category.id;

  const ctx: MoveContext = { facilityId, queueId, t };

  const move = async () => {
    if (!token || !newResourceId || !categoryId) return;
    setIsMoving(true);
    try {
      const result = token.booking
        ? await moveAppointment(ctx, token, selectedResource, categoryId)
        : await moveDirectToken(ctx, token, selectedResource, categoryId);
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: ["infinite-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["token-queue-summary"] });
      queryClient.invalidateQueries({ queryKey: ["token", tokenId] });
      if (token.booking) {
        queryClient.invalidateQueries({
          queryKey: ["appointment", token.booking.id],
        });
      }
      toast.success(
        t("token_moved_to_queue", {
          name: resourceName(selectedResource),
          token: renderTokenNumber(result.token),
          old: renderTokenNumber(token),
        }),
      );
      onOpenChange(false);
      onMoved?.(result.token, result.appointmentId);
    } catch {
      // The request error is already shown
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("change_queue")}</SheetTitle>
          <SheetDescription>
            {token
              ? t("change_queue_description", {
                  token: renderTokenNumber(token),
                  patient: token.patient?.name ?? "",
                })
              : t("loading")}
          </SheetDescription>
        </SheetHeader>
        {token && (
          <div className="mt-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-900">
                {t("select_resource_type")}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(SchedulableResourceType).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      selectedResource.resource_type === type &&
                        "ring-2 ring-primary text-primary bg-primary/5",
                    )}
                    onClick={() =>
                      setSelectedResource({
                        resource: null,
                        resource_type: type,
                      } as ScheduleResourceFormState)
                    }
                  >
                    {t(`resource_type__${type}`)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-900">
                {t(`schedulable_resource__${selectedResource.resource_type}`)}
              </span>
              <ScheduleResourceSelector
                facilityId={facilityId}
                selectedResource={selectedResource}
                setSelectedResource={setSelectedResource}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-900">
                {t("category")}
              </span>
              <RadioInput
                value={categoryId}
                onValueChange={setCategoryId}
                options={
                  categories?.results.map((category) => ({
                    value: category.id,
                    label: `${category.name}${
                      category.shorthand ? ` (${category.shorthand})` : ""
                    }`,
                  })) ?? []
                }
              />
            </div>
            <p className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              {token.booking
                ? t("change_queue_note_appointment")
                : t("change_queue_note_token")}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                disabled={
                  isMoving || unchanged || !newResourceId || !categoryId
                }
                onClick={move}
              >
                <ArrowRightLeft />
                {isMoving ? t("moving") : t("move_patient")}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface MoveContext {
  facilityId: string;
  queueId: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}

async function moveAppointment(
  { facilityId, queueId, t }: MoveContext,
  token: TokenRetrieve,
  target: ScheduleResourceFormState,
  category: string,
) {
  const booking = token.booking!;
  // Today's next slot of the right doctor / service with room left
  const { results: slots } = await callApi(scheduleApis.slots.getSlotsForDay, {
    pathParams: { facilityId },
    body: {
      resource_type: target.resource_type,
      resource_id: target.resource!.id,
      day: dateQueryString(new Date()),
    },
  });
  const now = Date.now();
  const slot = slots.find(
    (s) =>
      s.id !== booking.token_slot?.id &&
      new Date(s.end_datetime).getTime() > now &&
      s.allocated < s.availability.tokens_per_slot,
  );
  if (!slot) {
    toast.error(
      t("no_open_slot_today_to_move", { name: resourceName(target) }),
    );
    return null;
  }
  const full = await callApi(scheduleApis.appointments.retrieve, {
    pathParams: { facilityId, id: booking.id },
  });
  const moved = await callApi(scheduleApis.appointments.reschedule, {
    pathParams: { facilityId, id: booking.id },
    body: {
      new_slot: slot.id,
      previous_booking_note: full.note,
      new_booking_note: full.note,
      tags: (full.tags ?? []).map((tag) => tag.id),
    },
  });
  await cancelToken({ facilityId, queueId, t }, token, target);
  if (full.status === AppointmentStatus.CHECKED_IN) {
    await callApi(scheduleApis.appointments.update, {
      pathParams: { facilityId, id: moved.id },
      body: { status: AppointmentStatus.CHECKED_IN, note: full.note },
    });
  }
  // Into the doctor / service's main queue of the day (where the waiting
  // list and TV are), if there is one already
  const { results: queues } = await callApi(tokenQueueApi.list, {
    pathParams: { facility_id: facilityId },
    queryParams: {
      resource_type: target.resource_type,
      resource_id: target.resource!.id,
      date: dateQueryString(new Date()),
      limit: 50,
    },
  });
  // Same doctor / service (only the category was wrong): stay in the queue
  // the patient is in now
  const sameResource = target.resource!.id === token.resource?.id;
  const primary = sameResource
    ? queues.find((queue) => queue.id === queueId)
    : (queues.find((queue) => queue.is_primary && !queue.system_generated) ??
      queues.find((queue) => queue.is_primary));
  const newToken = (await callApi(scheduleApis.appointments.generateToken, {
    pathParams: { facilityId, id: moved.id },
    body: {
      category,
      note: token.note,
      ...(primary ? { queue: primary.id } : {}),
    },
  })) as unknown as TokenRead;
  return { token: newToken, appointmentId: moved.id };
}

async function moveDirectToken(
  { facilityId, queueId, t }: MoveContext,
  token: TokenRetrieve,
  target: ScheduleResourceFormState,
  category: string,
) {
  const newToken = await callApi(tokenQueueApi.generateToken, {
    pathParams: { facility_id: facilityId },
    body: {
      patient: token.patient?.id,
      category,
      note: token.note,
      resource_type: target.resource_type,
      resource_id: target.resource!.id,
      date: dateQueryString(new Date()),
    },
  });
  await cancelToken({ facilityId, queueId, t }, token, target);
  return { token: newToken, appointmentId: undefined };
}

function cancelToken(
  { facilityId, queueId, t }: MoveContext,
  token: TokenRetrieve,
  target: ScheduleResourceFormState,
) {
  return callApi(tokenApi.update, {
    pathParams: { facility_id: facilityId, queue_id: queueId, id: token.id },
    body: {
      status: TokenStatus.CANCELLED,
      note: [token.note, t("moved_to_note", { name: resourceName(target) })]
        .filter(Boolean)
        .join(" · "),
      sub_queue: null,
    },
  });
}
