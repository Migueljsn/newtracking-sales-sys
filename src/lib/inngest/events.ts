import { eventType, staticSchema } from "inngest";

export const enrollAllEvent = eventType("journey/enroll-all", {
  schema: staticSchema<{ journeyId: string; clientId: string }>(),
});

export const stepEvent = eventType("journey/step", {
  schema: staticSchema<{
    enrollmentId: string;
    journeyId:    string;
    leadId:       string;
    nodeId:       string;
    clientId:     string;
  }>(),
});

export const leadChangedEvent = eventType("lead/changed", {
  schema: staticSchema<{ leadId: string; clientId: string }>(),
});

export const audienceMemberEnteredEvent = eventType("audience/member-entered", {
  schema: staticSchema<{ audienceId: string; leadId: string; clientId: string }>(),
});

export const whatsappReplyEvent = eventType("whatsapp/reply", {
  schema: staticSchema<{ leadId: string; clientId: string; message: string; phone: string }>(),
});

export const flowStepEvent = eventType("flow/step", {
  schema: staticSchema<{
    enrollmentId: string;
    flowId:       string;
    leadId:       string;
    nodeId:       string;
    clientId:     string;
  }>(),
});

export const flowEnrollEvent = eventType("flow/enroll", {
  schema: staticSchema<{ flowId: string; leadId: string; clientId: string }>(),
});
