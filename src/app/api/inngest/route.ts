import { serve }                       from "inngest/next";
import { inngest }                     from "@/lib/inngest/client";
import { journeyEnrollAll }            from "@/lib/inngest/functions/journey-enroll-all";
import { journeyProcessStep }          from "@/lib/inngest/functions/journey-process-step";
import { journeyCheckEnrollment }      from "@/lib/inngest/functions/journey-check-enrollment";
import { journeyCronEnroll }           from "@/lib/inngest/functions/journey-cron-enroll";
import { syncAudienceMembership }      from "@/lib/inngest/functions/sync-audience-membership";
import { scheduleTimeBasedChecks }     from "@/lib/inngest/functions/schedule-time-based-checks";
import { flowProcessStep, flowEnroll } from "@/lib/inngest/functions/flow-process-step";
import { flowCheckEnrollment }         from "@/lib/inngest/functions/flow-check-enrollment";
import { flowEnrollAll }               from "@/lib/inngest/functions/flow-enroll-all";
import { aiAgentStep }                 from "@/lib/inngest/functions/ai-agent-step";

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    journeyEnrollAll,
    journeyProcessStep,
    journeyCheckEnrollment,
    journeyCronEnroll,
    syncAudienceMembership,
    scheduleTimeBasedChecks,
    flowProcessStep,
    flowEnroll,
    flowCheckEnrollment,
    flowEnrollAll,
    aiAgentStep,
  ],
});
