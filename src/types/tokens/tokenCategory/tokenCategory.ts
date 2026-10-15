import { SchedulableResourceType } from "@/types/scheduling/schedule";
import { UserReadMinimal } from "@/types/user/user";

export interface TokenCategory {
  id: string;
  name: string;
  resource_type: SchedulableResourceType;
  shorthand: string;
  metadata?: Record<string, unknown> | null;
}

export type TokenCategoryCreate = Omit<TokenCategory, "id">;

export type TokenCategoryRead = TokenCategory & {
  default: boolean;
};

export interface TokenCategoryUpdate {
  name: string;
  resource_type: SchedulableResourceType;
  shorthand: string;
  metadata?: Record<string, unknown> | null;
}

export interface TokenCategoryRetrieveSpec extends TokenCategoryRead {
  created_by: UserReadMinimal;
  updated_by: UserReadMinimal;
}

export type CallPriority = "normal" | "high" | "emergency";

const EMERGENCY_CATEGORY = /emergency|urgent|आपात/i;
const PRIORITY_CATEGORY =
  /senior|elderly|pregnan|priority|vip|divyang|disab|वरिष्ठ|गर्भवती/i;

/**
 * Call priority of a category, used by Serve Next. Set by an admin in Token
 * Category settings (stored in metadata.priority); without it, the name
 * decides ("Emergency" first, then "Senior Citizen", "Pregnant", ...).
 */
export function callPriorityOf(category: {
  name: string;
  metadata?: Record<string, unknown> | null;
}): CallPriority {
  const flag = category.metadata?.priority;
  if (flag === "emergency") return "emergency";
  if (flag === true || flag === "high") return "high";
  if (flag === "normal") return "normal";
  if (EMERGENCY_CATEGORY.test(category.name)) return "emergency";
  if (PRIORITY_CATEGORY.test(category.name)) return "high";
  return "normal";
}
