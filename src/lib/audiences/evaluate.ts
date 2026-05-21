import { Rule, RuleGroup, isGroup } from "./types"

type Sale = { value: number | string; soldAt: Date }
type LeadRow = {
  status: string
  pipelineStageId: string | null
  capturedAt: Date
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  consultant: string | null
  customer: {
    state: string | null
    city: string | null
    email: string | null
  } | null
  sales: Sale[]
}

export function evaluateGroup(lead: LeadRow, group: RuleGroup): boolean {
  if (group.rules.length === 0) return true
  const results = group.rules.map((r) =>
    isGroup(r) ? evaluateGroup(lead, r) : evaluateRule(lead, r)
  )
  return group.operator === "AND" ? results.every(Boolean) : results.some(Boolean)
}

function evaluateRule(lead: LeadRow, rule: Rule): boolean {
  const { field, operator, value } = rule

  switch (field) {
    case "status":
      return applyStringOp(lead.status, operator, value)

    case "pipelineStageId":
      if (operator === "empty") return !lead.pipelineStageId
      return applyStringOp(lead.pipelineStageId ?? "", operator, value)

    case "daysSinceCapture": {
      const days = daysBetween(lead.capturedAt, new Date())
      return applyNumberOp(days, operator, parseFloat(value))
    }

    case "utmSource":    return applyStringOp(lead.utmSource    ?? "", operator, value)
    case "utmMedium":   return applyStringOp(lead.utmMedium    ?? "", operator, value)
    case "utmCampaign": return applyStringOp(lead.utmCampaign  ?? "", operator, value)
    case "consultant":  return applyStringOp(lead.consultant   ?? "", operator, value)

    case "state": return applyStringOp(lead.customer?.state ?? "", operator, value)
    case "city":  return applyStringOp(lead.customer?.city  ?? "", operator, value)

    case "hasEmail":
      return operator === "true" ? !!lead.customer?.email : !lead.customer?.email

    case "hasSales":
      return operator === "true" ? lead.sales.length > 0 : lead.sales.length === 0

    case "salesCount":
      return applyNumberOp(lead.sales.length, operator, parseFloat(value))

    case "daysSinceLastSale": {
      if (lead.sales.length === 0) return false
      const last = lead.sales.reduce((a, b) =>
        new Date(a.soldAt) > new Date(b.soldAt) ? a : b
      )
      const days = daysBetween(new Date(last.soldAt), new Date())
      return applyNumberOp(days, operator, parseFloat(value))
    }

    case "totalRevenue": {
      const total = lead.sales.reduce((sum, s) => sum + parseFloat(String(s.value)), 0)
      return applyNumberOp(total, operator, parseFloat(value))
    }

    default:
      return false
  }
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
}

function applyStringOp(actual: string, op: string, expected: string): boolean {
  const a = actual.toLowerCase()
  const e = expected.toLowerCase()
  switch (op) {
    case "eq":          return a === e
    case "neq":         return a !== e
    case "contains":    return a.includes(e)
    case "not_contains":return !a.includes(e)
    case "empty":       return actual.trim() === ""
    case "not_empty":   return actual.trim() !== ""
    default:            return false
  }
}

function applyNumberOp(actual: number, op: string, expected: number): boolean {
  switch (op) {
    case "eq":  return actual === expected
    case "gt":  return actual >  expected
    case "gte": return actual >= expected
    case "lt":  return actual <  expected
    case "lte": return actual <= expected
    default:    return false
  }
}
