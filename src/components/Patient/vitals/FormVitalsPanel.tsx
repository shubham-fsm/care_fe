import careConfig from "@careConfig";
import { useQuery } from "@tanstack/react-query";

import { VitalsList } from "@/components/Patient/vitals/list";
import { ObservationPlotConfig } from "@/types/emr/observation/observation";

interface Props {
  patientId: string;
  encounterId: string;
  className?: string;
}

/**
 * The encounter's recorded vitals, shown beside a form so the doctor does not
 * have to go back to the overview to look them up while filling it.
 */
export function FormVitalsPanel({ patientId, encounterId, className }: Props) {
  const { data: plotsConfig } = useQuery<ObservationPlotConfig>({
    queryKey: ["plots-config"],
    queryFn: () => fetch(careConfig.plotsConfigUrl).then((res) => res.json()),
  });

  const vitalGroups =
    plotsConfig?.find((plot) => plot.id === "primary-parameters")?.groups || [];

  if (!vitalGroups.length) {
    return null;
  }

  return (
    <VitalsList
      patientId={patientId}
      encounterId={encounterId}
      codeGroups={vitalGroups}
      className={className}
    />
  );
}
