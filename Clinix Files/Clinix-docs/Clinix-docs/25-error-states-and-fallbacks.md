# 25 — Error States and Fallbacks (new)

Principle: **fail safe, never reassure on failure.**

| Failure | Behavior |
|---|---|
| NVIDIA timeout or error | Retry once; then show "can't complete assessment", emergency number, and facility search |
| Invalid or unsafe model output | Reject; retry once; then same safe failure |
| Rule set fails to load | Use bundled last-known-good rules; alert operators |
| MongoDB unavailable | Assessment still works statelessly if possible, with no save; emergency page unaffected |
| Maps provider down | Show manual search link and emergency numbers |
| Location denied | Offer manual town/area entry |
| Rate limited | Explain, show retry time, keep emergency link visible |
| Feature disabled by kill switch | Show maintenance message plus emergency and care-finder alternatives |
| Offline device | Cached `/emergency` page with numbers and basic reviewed instructions |

## Standard safe-failure message

> We couldn't complete your assessment right now. This is not a sign that you are fine. If you have severe or worsening symptoms, call **112** now or go to the nearest health facility.

## Requirements

- Every failure state has a designed UI, not a blank screen or raw error.
- No failure path may output "no problem found", "likely harmless" or similar.
- All failures log `requestId`, error code and provider, never patient content.
