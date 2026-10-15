import { z } from "zod";
import { localStore } from "~/lib/places/store";

/** Whether the sun path has ever been dragged or tapped; until then it carries a hint that it can be. */
export const scrubbedStore = localStore("twilit:scrubbed", z.boolean(), false);
