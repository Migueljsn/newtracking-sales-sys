import { serve }                       from "inngest/next";
import { inngest }                     from "@/lib/inngest/client";
import { journeyEnrollAll }            from "@/lib/inngest/functions/journey-enroll-all";
import { journeyProcessStep }          from "@/lib/inngest/functions/journey-process-step";
import { journeyCheckEnrollment }      from "@/lib/inngest/functions/journey-check-enrollment";

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [journeyEnrollAll, journeyProcessStep, journeyCheckEnrollment],
});
