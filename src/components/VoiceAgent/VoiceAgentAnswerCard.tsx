import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Markdown } from "@/components/ui/markdown";

import {
  VoiceAgentAnswer,
  VoiceAgentResolution,
} from "@/components/VoiceAgent/voiceAgentApi";

const RESOLUTION_VARIANT: Record<
  VoiceAgentResolution,
  "green" | "blue" | "orange" | "purple" | "yellow" | "secondary"
> = {
  how_to: "green",
  data_or_permissions: "green",
  configuration: "blue",
  frontend_change: "orange",
  backend_change: "orange",
  frontend_and_backend_change: "orange",
  plugin_change: "purple",
  needs_more_info: "yellow",
  not_care_related: "secondary",
};

interface Props {
  answer: VoiceAgentAnswer;
  onSpeak: (text: string) => void;
}

export function VoiceAgentAnswerCard({ answer, onSpeak }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <Badge variant={RESOLUTION_VARIANT[answer.resolution_type]}>
          {t(`voice_agent_resolution__${answer.resolution_type}`)}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t("voice_agent_read_aloud")}
          onClick={() => onSpeak(answer.spoken_summary)}
        >
          <Volume2 className="size-4" />
        </Button>
      </div>

      <p className="text-gray-900">{answer.spoken_summary}</p>

      {answer.config_changes.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-gray-700">
            {t("voice_agent_config_changes")}
          </p>
          {answer.config_changes.map((change, i) => (
            <div key={i} className="rounded-md bg-gray-50 p-2">
              <p className="text-xs text-gray-500">
                {t(`voice_agent_where__${change.where}`)}
              </p>
              <code className="break-all text-xs font-semibold">
                {change.key}={change.value}
              </code>
              <p className="text-xs text-gray-600">{change.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {answer.code_changes.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-gray-700">
            {t("voice_agent_code_changes")}
          </p>
          {answer.code_changes.map((change, i) => (
            <div key={i} className="rounded-md bg-gray-50 p-2">
              <code className="break-all text-xs font-semibold">
                {change.repo}: {change.file}
              </code>
              <p className="text-xs text-gray-600">{change.change}</p>
            </div>
          ))}
        </div>
      )}

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="link" className="h-auto p-0 text-xs">
            {t("voice_agent_show_details")}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <Markdown content={answer.details_markdown} className="prose-sm" />
          {answer.references.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700">
                {t("voice_agent_references")}
              </p>
              <ul className="list-disc pl-4 text-xs text-gray-500">
                {answer.references.map((ref) => (
                  <li key={ref} className="break-all">
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {answer.follow_up_question && (
        <p className="italic text-gray-700">{answer.follow_up_question}</p>
      )}
    </div>
  );
}
