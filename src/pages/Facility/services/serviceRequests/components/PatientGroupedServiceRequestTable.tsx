import { navigate } from "raviger";
import { useTranslation } from "react-i18next";

import CareIcon from "@/CAREUI/icons/CareIcon";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { LocationNode } from "@/components/Location/LocationTree";
import { cn } from "@/lib/utils";
import {
  SERVICE_REQUEST_PRIORITY_COLORS,
  SERVICE_REQUEST_STATUS_COLORS,
} from "@/types/emr/serviceRequest/serviceRequest";
import { getTagHierarchyDisplay } from "@/types/emr/tagConfig/tagConfig";

import {
  getGroupPriority,
  getGroupStatus,
  getGroupTags,
  PatientRequestGroup,
} from "@/pages/Facility/services/serviceRequests/utils/groupServiceRequestsByPatient";

interface PatientGroupedServiceRequestTableProps {
  groups: PatientRequestGroup[];
  facilityId: string;
  locationId?: string;
  onPatientClick?: (group: PatientRequestGroup) => void;
}

export default function PatientGroupedServiceRequestTable({
  groups,
  facilityId,
  locationId,
  onPatientClick,
}: PatientGroupedServiceRequestTableProps) {
  const { t } = useTranslation();

  const handleViewDashboard = (group: PatientRequestGroup) => {
    const baseUrl = locationId
      ? `/facility/${facilityId}/locations/${locationId}/service_requests`
      : `/facility/${facilityId}/service_requests`;
    navigate(`${baseUrl}/patient/${group.patientId}`);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-gray-100">
          <TableRow className="divide-gray-200">
            <TableHead>{t("patient_name")}</TableHead>
            <TableHead>{t("service_type")}</TableHead>
            <TableHead>
              {t("status")}/{t("priority")}
            </TableHead>
            <TableHead>{t("tags", { count: 2 })}</TableHead>
            <TableHead>{t("location")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white">
          {groups.map((group) => {
            const status = getGroupStatus(group);
            const priority = getGroupPriority(group);
            const tags = getGroupTags(group);
            const location = group.requests[0]?.encounter.current_location;

            return (
              <TableRow
                key={group.patientId}
                className="divide-x divide-gray-200 group"
              >
                <TableCell
                  className={cn(
                    "font-medium align-top",
                    onPatientClick && "group-hover:underline cursor-pointer",
                  )}
                  onClick={() => onPatientClick?.(group)}
                >
                  <div className="font-semibold text-gray-900">
                    {group.patientName}
                  </div>
                  <div className="text-xs text-gray-500">{group.patientId}</div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="text-xs text-gray-500 mb-1">
                    {t("tests_count", { count: group.requests.length })}
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.requests.map((request) => (
                      <div key={request.id} className="text-sm">
                        {request.title || "-"}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="flex flex-col gap-1 align-top">
                  <Badge variant={SERVICE_REQUEST_STATUS_COLORS[status]}>
                    {t(status)}
                  </Badge>
                  <Badge variant={SERVICE_REQUEST_PRIORITY_COLORS[priority]}>
                    {t(priority)}
                  </Badge>
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="capitalize"
                        title={tag.description}
                      >
                        {getTagHierarchyDisplay(tag)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="text-xs text-gray-500">
                    {location && (
                      <LocationNode location={location} isLast={true} />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-left align-top">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDashboard(group)}
                  >
                    <CareIcon icon="l-edit" />
                    {t("see_details")}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
