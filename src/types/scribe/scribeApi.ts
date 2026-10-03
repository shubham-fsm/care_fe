import { HttpMethod, Type } from "@/Utils/request/types";

import { ScribeResult } from "./scribe";

export default {
  fill: {
    path: "/api/scribe_lite/fill/",
    method: HttpMethod.POST,
    TRes: Type<ScribeResult>(),
    TBody: Type<FormData>(),
  },
} as const;
