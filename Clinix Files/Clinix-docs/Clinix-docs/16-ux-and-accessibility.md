# 16 — User Experience and Accessibility

The platform should feel reassuring, modern and clear, not like an ordinary developer chatbot.

## Main pages

| Page | Content |
|---|---|
| Landing | Clear explanation, start-assessment action, emergency link, how it works, privacy explanation, supported regions |
| Symptom checker | Chat history, progress indicator, structured follow-up questions, emergency controls, clear option to stop |
| Assessment results | Urgency and next action first, then possible explanations, uncertainties, safety guidance, care options |
| Care finder | Search field, list/map switch, facility details, directions, contact options, location permission controls |

## Accessibility requirements

- Mobile-first responsive design
- Keyboard navigation and screen-reader labels
- High contrast and readable text
- Plain language, not unexplained medical terminology
- Multiple languages only where the full workflow has been reviewed for that language
- Clear loading, timeout, error and retry states
- Emergency actions easy to find and usable without navigating multiple screens

## Design principles (new)

1. **Calm, not alarming.** Reserve red and strong motion for genuine emergencies.
2. **Urgency first.** The result screen opens with the care category and next action.
3. **One question at a time** on mobile, with quick-reply chips for common answers (yes / no / not sure).
4. **Always show an exit.** "Stop and see my current guidance" is visible throughout the assessment.
5. **Persistent emergency access.** A header action visible on every screen.
6. **Honest empty and error states.** Never display fake results, and never reassure on failure.
7. **Low-bandwidth friendly.** Target Ghanaian mobile networks: small bundles, lazy loading, optimistic UI, offline emergency page.

## Components to design (new)

`EmergencyBanner`, `ChatBubble`, `QuickReplyChips`, `UrgencyBadge`, `ConditionCard`, `UncertaintyList`, `FacilityCard`, `LocationPermissionPrompt`, `ConsentDialog`, `DisclaimerFooter`.

## Accessibility acceptance (new)

- WCAG 2.2 AA contrast
- Text scalable to 200% without loss of function
- Focus states visible, logical tab order
- Urgency never conveyed by color alone (icon and text label too)
- Screen-reader tested: chat live region announces new assistant messages
