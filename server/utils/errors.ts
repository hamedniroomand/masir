// A repository throws these errors. An endpoint converts each one to a status code.

export class SlugTakenError extends Error {
  constructor() {
    super('taken');
  }
}

export class SlugExhaustedError extends Error {
  constructor() {
    super('exhausted');
  }
}

export class CampaignTakenError extends Error {
  constructor() {
    super('taken');
  }
}

export class InvalidTagNameError extends Error {
  constructor() {
    super('invalid');
  }
}

export class TagNameTakenError extends Error {
  constructor() {
    super('taken');
  }
}

export class VisitLimitBelowUsageError extends Error {
  constructor() {
    super('below-usage');
  }
}

export class AliasLimitError extends Error {
  constructor() {
    super('alias-limit');
  }
}
