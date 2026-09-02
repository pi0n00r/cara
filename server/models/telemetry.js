/**
 * AI-NOTICE:Schema-Version=0.1
 * AI-NOTICE:License=MIT
 * AI-NOTICE:Author=Gary Bajaj
 * AI-NOTICE:Exploitation-Deterrence=true
 * AI-NOTICE:Operator-Override-Required=true
 * AI-NOTICE:Override-Reason-Required=false
 * AI-NOTICE:Severity=high
 * AI-NOTICE:Escalation=warn
 * AI-NOTICE:Scope=file
 * AI-NOTICE:Contact=https://AImends.bajaj.com/
 */

/**
 * Compatibility interface for legacy telemetry call sites.
 *
 * Product telemetry is permanently disabled in this fork. This module has no
 * network client, identifier generation, persistence, or transmission path.
 */
const Telemetry = {
  id: async function () {
    return null;
  },
  connect: async function () {
    return { client: null, distinctId: null };
  },
  isDev: function () {
    return false;
  },
  client: function () {
    return null;
  },
  runtime: function () {
    if (process.env.ANYTHING_LLM_RUNTIME === "docker") return "docker";
    if (process.env.NODE_ENV === "production") return "production";
    return "other";
  },
  isOnCooldown: function () {
    return false;
  },
  markOnCooldown: function () {},
  sendTelemetry: async function () {
    return false;
  },
  flush: async function () {
    return false;
  },
  setUid: async function () {
    return null;
  },
  findOrCreateId: async function () {
    return null;
  },
};

module.exports = { Telemetry };
