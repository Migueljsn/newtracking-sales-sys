import { serve }                       from "inngest/next";
import { inngest }                     from "@/lib/inngest/client";
import { journeyEnrollAll }            from "@/lib/inngest/functions/journey-enroll-all";
import { journeyProcessStep }          from "@/lib/inngest/functions/journey-process-step";
import { journeyCheckEnrollment }      from "@/lib/inngest/functions/journey-check-enrollment";
import { syncAudienceMembership }      from "@/lib/inngest/functions/sync-audience-membership";
import { scheduleTimeBasedChecks }     from "@/lib/inngest/functions/schedule-time-based-checks";

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    journeyEnrollAll,
    journeyProcessStep,
    journeyCheckEnrollment,
    syncAudienceMembership,
    scheduleTimeBasedChecks,
  ],
});
