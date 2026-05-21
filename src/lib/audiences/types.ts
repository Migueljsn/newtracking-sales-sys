export type Rule = {
  id: string
  field: string
  operator: string
  value: string
}

export type RuleGroup = {
  id: string
  operator: "AND" | "OR"
  rules: (Rule | RuleGroup)[]
}

export function isGroup(r: Rule | RuleGroup): r is RuleGroup {
  return "rules" in r
}

export function emptyGroup(): RuleGroup {
  return { id: crypto.randomUUID(), operator: "AND", rules: [] }
}

export function emptyRule(): Rule {
  return { id: crypto.randomUUID(), field: "status", operator: "eq", value: "NEW" }
}
