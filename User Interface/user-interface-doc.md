# Clinix — Complete UI Functionality & System Flow Documentation

This documentation defines how every part of Clinix works together, from the moment a patient opens the website to symptom assessment, AI-generated guidance, medication information, clinic discovery, emergency assistance, medical history, and administration.

The goal is to make Clinix feel simple to patients while being engineered to an enterprise standard behind the scenes.

Technology stack: Next.js, TypeScript, MongoDB, and NVIDIA-hosted AI models.

Core principle: Every visible element must have a defined action, every action must have a clear outcome, and every asynchronous action must handle loading, success, empty, and failure states.

## 1. Overall application architecture

### Clinix Patient Interface

Home · Symptom Checker · Medications · Clinics · Emergency · History

Next.js application layer

Pages · Forms · Validation · Session handling · UI states

Secure server-side API

Authentication · Authorization · Rate limits · Safety rules · Input validation

MongoDB

Users, sessions, assessments, saved records, facilities and audit events

NVIDIA AI

Symptom explanations and health information, subject to safety controls

The browser must never call NVIDIA with a secret API key directly. All AI requests go through a protected server endpoint. Emergency rules must also work independently of the AI model, so a model timeout cannot prevent urgent guidance.

## 2. Complete page and navigation map

| Page               | Purpose                                | Main actions                                           |
| ------------------ | -------------------------------------- | ------------------------------------------------------ |
| Home               | Entry point to the platform            | Start symptom check, search, open shortcuts            |
| Symptom Checker    | Guided symptom assessment              | Enter symptoms, answer questions, view next steps      |
| Medications        | Educational medication information     | Search a medicine, read safety information             |
| Find Clinics       | Locate relevant healthcare facilities  | Search by location, filter, view contact details       |
| Emergency          | Quickly access urgent-help information | Call emergency services, view local contacts           |
| My History         | Review previous assessments            | Open, search, delete or export records where supported |
| Sign in / Register | Secure account access                  | Create account, sign in, verify email                  |
| Password Recovery  | Restore account access                 | Request reset, validate link, choose new password      |
| Profile & Settings | Manage account and privacy             | Edit details, consent, security, data controls         |
| Admin Dashboard    | Operate and maintain Clinix            | Manage facilities, content, users and audit records    |

The sidebar should collapse on smaller screens into a menu button. On mobile, the main actions should remain easy to reach without horizontal scrolling.

## 3. Global UI behavior and design rules

These rules apply across the entire application, not just the home page.

### 3.1 Shared application layout

Sidebar

Navigation, active-page highlight, collapse/expand behavior, mobile drawer.

Top bar

Global search, notifications, profile menu and sign-out.

Main content

Page title, description, primary action, page content and contextual help.

Persistent safety and privacy

Clear medical limitations, privacy controls and an accessible emergency entry point.

### 3.2 Standard interaction states

Every button, form, API request and data-dependent component must use the appropriate states below.

| State            | Expected behavior                                                           |
| ---------------- | --------------------------------------------------------------------------- |
| Initial          | Show useful content and available actions.                                  |
| Hover            | Subtle visual feedback; never rely on hover alone.                          |
| Focus            | Visible keyboard focus indicator.                                           |
| Pressed          | Immediate feedback when a user activates a control.                         |
| Loading          | Disable duplicate submissions and show progress.                            |
| Success          | Confirm the completed action and update the interface.                      |
| Validation error | Show the problem beside the relevant field.                                 |
| Request error    | Explain the failure and provide a retry option where safe.                  |
| Empty            | Explain that no results exist and how to continue.                          |
| Unauthorized     | Redirect to sign-in or show an access-denied page.                          |
| Offline          | Explain that the connection is unavailable and preserve safe, unsent input. |

Loading screen rules

- Use skeleton cards for dashboard data and facility lists.
- Use button-level spinners for short submissions.
- Use a step indicator for long, multi-question assessments.
- Show a progress message when waiting for AI, without inventing a percentage.
- After a reasonable timeout, stop waiting indefinitely and show a retry option.
- Preserve the user's form data when a request fails.
- Never display fake AI responses or fabricated clinic results as fallback content.

## 4. Home dashboard — complete functionality

The home page is the central navigation point. It should help a first-time visitor understand what Clinix does within seconds.

### 4.1 Welcome banner

Elements: Welcome text, brief explanation, illustration, and primary “Start Symptom Checker” button.

When the button is clicked:

1. Check whether the patient is authenticated if the feature requires an account.
2. Open the symptom-checker introduction.
3. Explain what information will be requested and how it will be used.
4. Present a prominent emergency warning for users who may be experiencing a life-threatening situation.
5. Start the assessment when the patient chooses to continue.

Do not require a user to complete registration before seeing emergency instructions.

### 4.2 Feature cards

| Card                | Click behavior                                             |
| ------------------- | ---------------------------------------------------------- |
| Symptom Checker     | Opens the guided symptom assessment.                       |
| Medications         | Opens the medication search page.                          |
| Find Nearby Clinics | Opens facility discovery and location options.             |
| Emergency           | Opens emergency guidance and available emergency contacts. |

Cards must be fully clickable without nested, conflicting click targets. Each card needs a keyboard-accessible link and a clear title.

### 4.3 Health assistant

The home assistant can accept questions such as “What can cause a headache?” and direct users to the dedicated symptom checker when a structured assessment is more appropriate.

It must:

- Distinguish general health education from symptom assessment.
- Ask relevant follow-up questions when needed.
- Display a clear limitation that AI output is not a confirmed diagnosis.
- Detect emergency indicators and switch to emergency guidance.
- Avoid issuing personalized prescriptions or unsupported medication dosages.
- Offer links to relevant Clinix features instead of trying to do everything in one chat.

Suggested quick prompts can include “I have a fever,” “I have a headache,” and “I have a cough.” A chest-pain prompt must not lead to an ordinary, leisurely questionnaire when the symptoms suggest an emergency.

### 4.4 Quick access and notifications

Quick access links open nearby clinics, emergency contacts and saved health records.

Notifications should cover relevant account and platform events, such as:

- Assessment saved successfully.
- Password or security settings changed.
- Important privacy-policy updates.
- Service maintenance or feature availability.

Do not create alarming health notifications based on an unreviewed AI prediction. Users should be able to mark notifications as read and access their notification history.

## 5. Symptom Checker — end-to-end patient flow

This is the most safety-sensitive part of Clinix and needs the most rigorous validation.

#### 1

Introduction and safety notice

#### 2

Describe symptoms

#### 3

Check for urgent warning signs

#### 4

Collect relevant details

#### 5

Run safety rules and AI analysis

#### 6

Display guidance and next steps

#### 7

Save or review assessment

### Step 1: Introduction

Display:

- What the assessment can and cannot do.
- A privacy explanation.
- An emergency warning.
- A “Begin assessment” action.
- A way to exit without saving.

Do not imply that Clinix can reliably diagnose every condition.

### Step 2: Symptom input

Fields:

| Field               | Behavior                                              |
| ------------------- | ----------------------------------------------------- |
| Main symptom        | Required free-text description.                       |
| Body area           | Optional guided selection.                            |
| Duration            | Structured choice, including an unknown option.       |
| Severity            | Clearly explained scale, not a diagnostic conclusion. |
| Additional symptoms | Optional text or selectable suggestions.              |
| Age range           | Collect only what is necessary for safe guidance.     |
| Relevant context    | Ask follow-up questions only when necessary.          |

Do not assume the patient's age, sex, pregnancy status, medical history or medications. Ask sensitive questions only when relevant, explain why they are needed, and permit “Prefer not to say” where medically appropriate.

Input validation

- Reject empty or whitespace-only submissions.
- Set sensible character limits.
- Display a clear message when the description is too long.
- Preserve valid input on errors.
- Sanitize and validate on the server; client validation alone is insufficient.

### Step 3: Emergency screening

Before ordinary AI analysis, run deterministic, clinically reviewed safety checks on the symptom description and follow-up answers.

Examples of possible warning signs include severe breathing difficulty, signs of stroke, unresponsiveness, severe bleeding, and severe or persistent chest pain.

When a potentially life-threatening warning sign is detected:

1. Stop the routine assessment.
2. Display an urgent, prominent emergency message.
3. Show the appropriate verified local emergency contact.
4. Offer a tap-to-call link on supported devices.
5. Tell the user not to wait for AI analysis.
6. Log the safety event without unnecessarily storing sensitive free text.

This screening must be tested independently of the NVIDIA model. A negative screening result does not guarantee that a condition is safe.

### Step 4: Follow-up questions

Ask focused questions based on the information already provided.

For example, a headache assessment may need to establish onset, severity, associated symptoms and relevant warning signs.

The interface should show:

- Current question and step number.
- Answer choices where possible.
- Back and continue buttons.
- A way to correct previous answers.
- An option to exit.
- Clear validation messages.

Do not ask every user a fixed list of dozens of questions. The flow should adapt to relevant information while keeping safety-critical questions mandatory when indicated.

### Step 5: Analysis and loading

When the patient submits the completed assessment:

1. Validate the payload on the server.
2. Re-run the deterministic emergency rules.
3. Apply consent and authorization checks.
4. Send only the necessary, minimized information to the AI service.
5. Validate the model response against a strict response schema.
6. Check for unsafe, unsupported or malformed output.
7. Generate the final result only if the response passes validation.

Loading copy can say “Reviewing your answers…” or “Preparing your health guidance…”.

If NVIDIA is unavailable, Clinix should not invent an assessment. It should offer a retry, preserve the entered information and continue to show any already-triggered emergency guidance.

### Step 6: Assessment results

The result page should present information in this order:

### 1. Recommended next step

A clinically reviewed urgency category and a clear recommended action, when the available information supports one.

### 2. Possible explanations

Potential causes with uncertainty clearly explained. Never present AI-generated possibilities as confirmed diagnoses.

### 3. What to do next

Appropriate care-seeking advice, warning signs that require escalation, and links to nearby facilities where relevant.

### 4. Assessment details

Symptoms provided, answers used, assessment timestamp and whether the result was saved.

Avoid giving patients unsupported numerical probabilities, such as “92% chance you have malaria.” Do not allow an LLM alone to determine whether a patient can safely remain at home.

### Step 7: Save and review

After the result:

- Save assessment: Save the record to the authenticated patient's account after appropriate consent.
- View history: Open the saved record.
- Find a clinic: Carry forward the appropriate location and facility filters.
- Start new assessment: Start a fresh session without accidentally mixing old answers into it.
- Exit: Return to Home.

If saving fails, clearly distinguish between “assessment generated” and “assessment saved.” Do not tell the user that a record was saved unless the database confirms success.

## 6. Medications page

This page is for reliable medication education and safety information, not an unregulated prescription generator.

### Search flow

1. Patient enters a medicine name or active ingredient.
2. Validate the search and show a loading state.
3. Search the approved medication-information source.
4. Show matching results with the medicine name, active ingredient and source.
5. Patient selects a result to open its details.
6. Provide links to the authoritative source and relevant professional guidance.

### Medication detail page

Where reliable source data is available, show:

- Generic and brand names.
- Active ingredient.
- General purpose and approved uses.
- Important warnings and contraindications.
- Known side effects.
- Interaction warnings, when supported by a trustworthy source.
- Special-population cautions where relevant.
- Source and last-reviewed date.

Do not fabricate a medication entry if the search returns no verified match. Use an explicit “No verified information found” state.

### Medication interaction questions

If a user asks whether two medicines can be combined, collect the exact medicine names and relevant context only as necessary. If the information cannot be verified, explain that limitation and recommend a pharmacist or clinician. Do not make up an interaction assessment.

A medication search failure must never remove an existing emergency warning or delay urgent medical care.

## 7. Find Clinics — nearby healthcare facilities

The clinic page should work whether the user allows location access or enters a location manually.

### Search flow

1. Open the page.
2. Offer “Use my location” and a manual location field.
3. Request browser geolocation only after the user chooses it.
4. If permission is denied, continue with manual search.
5. Search the verified facilities database or an approved location provider.
6. Return matching facilities, sorted using a transparent and useful criterion.
7. Allow the patient to open facility details or contact the facility.

### Filters

- Distance or area.
- Facility type.
- Services offered.
- Availability or operating hours, only where reliable current data exists.
- Accessibility information, where verified.

### Clinic card

Each card should contain:

- Facility name.
- Verified address or location.
- Distance, if coordinates and user location are available.
- Verified contact number.
- Services and facility type.
- Operating hours and last-updated information, if supported.
- Directions and call actions.

### Empty, loading and failure states

- Loading: Show skeleton facility cards.
- No results: Suggest a broader area or removing filters.
- Location denied: Show manual search.
- Location unavailable: Explain that the browser could not determine the location.
- Provider unavailable: Show an error and retry button.
- Stale data: Clearly label unverified or outdated information rather than presenting it as current.

Never invent a clinic, phone number, distance or opening time. The directory must have a process for verifying and updating facility data.

## 8. Emergency page

Emergency assistance must be extremely simple, with as few steps as possible.

The page should include:

- A clear instruction to contact emergency services for a life-threatening situation.
- A verified emergency number for the patient's actual location.
- A tap-to-call action.
- Other verified emergency contacts only where appropriate.
- A short instruction to seek immediate help rather than wait for the AI.
- A fallback for unsupported devices or unavailable calling functionality.

For a Ghana deployment, verify the current ambulance and emergency contact arrangements with authoritative local sources before release. Do not assume the user is in Ghana simply because the product is being developed there.

### Emergency button behavior

When a user activates the call action:

1. Open the device's supported telephone handler using a `tel:` link where possible.
2. Do not claim that the call was placed or answered.
3. If calling is unavailable, display the number and instructions for contacting emergency services through another device.
4. Keep emergency instructions visible if another service is offline.

Important: A website cannot guarantee that a call connects, that an ambulance is dispatched, or that a facility can accept a patient. Do not imply that Clinix itself dispatches ambulances unless that capability is genuinely implemented and operational.

## 9. My History

This page contains the patient's previous saved assessments and related records.

### List view

Each record should show:

- Date and time.
- A brief symptom summary.
- The recommended next step recorded at the time.
- Save status and record type.
- An action to open details.

### Record detail view

The user can review the original symptoms, relevant answers, generated guidance, source information, and timestamps. Clearly label the result as historical; it must not imply that an old assessment describes the patient's current condition.

### History actions

| Action         | Required behavior                                                                   |
| -------------- | ----------------------------------------------------------------------------------- |
| Search         | Filter records owned by the authenticated user.                                     |
| Filter by date | Update the list and preserve a clear reset option.                                  |
| Open record    | Load the selected record with authorization checks.                                 |
| Delete         | Ask for confirmation, then delete or de-identify according to the retention policy. |
| Export         | Generate an authorized export and report success or failure.                        |
| Refresh        | Reload records without creating duplicate entries.                                  |

An empty history should show a friendly explanation and a “Start symptom checker” action. If the history API fails, show a retry option rather than falsely showing an empty account.

Every history endpoint must enforce ownership on the server, not just hide records in the UI.

## 10. Authentication and account recovery

### Registration

1. User selects Register.
2. Enters the required details.
3. Server validates the fields and checks account uniqueness.
4. Password is hashed using a modern password-hashing algorithm.
5. The user receives any required verification step.
6. The server establishes an authenticated session only according to the verification policy.
7. The user lands on the dashboard.

Keep account creation separate from medical consent. A user must not be considered to have consented to optional data processing simply by creating an account.

### Sign-in

- Validate the form.
- Display a button spinner during submission.
- Use a generic invalid-credentials message to avoid account enumeration.
- Apply rate limiting and suspicious-login protections.
- Redirect to the originally requested page only after safe URL validation.
- Restore the user's intended destination without resubmitting a medical form accidentally.

### Forgot password

1. User submits an email address.
2. Show a neutral confirmation that avoids revealing whether the account exists.
3. If the account exists, send a short-lived, single-use reset link.
4. Validate the reset token on the server.
5. Let the user choose and confirm a new password.
6. Invalidate the reset token and revoke existing sessions as appropriate.
7. Show success and offer sign-in.

### Logout

Show a confirmation only if needed for the product's session policy. Revoke or invalidate the server-side session, clear the appropriate cookies and redirect to the public page. Protected content must not remain accessible after logout simply because it is cached in the browser.

## 11. Profile, settings and privacy

Settings should be grouped into understandable sections rather than one long form.

Account

- Name and basic profile information.
- Email and verification status.
- Password and sign-in security.
- Sign-out and session controls.

Privacy

- Consent preferences.
- Health-data export and deletion requests.
- AI-processing explanation.
- Data retention and privacy policy.
- Optional location permission guidance.

Accessibility and preferences

- Theme if supported.
- Text size or other accessibility preferences where practical.
- Notification preferences.
- Language preferences if localization is implemented.

Every change must show whether it was saved. On failure, preserve the user's values and offer a retry. High-impact changes, such as deleting an account, need explicit confirmation and a clearly explained consequence.

Health records should not be exposed in notification previews, analytics events or URLs. Never put symptom descriptions or other sensitive health information into query parameters.

## 12. Admin dashboard functionality

The admin panel should be a separate protected area with role-based access control. A patient account must not be able to access it by changing a URL.

### Admin overview

Show operational information such as:

- Registered users and account status.
- Assessment counts and system health metrics.
- AI provider availability and error rates.
- Clinic-directory freshness.
- Failed jobs and unresolved operational issues.
- Security events and audit activity.

Use aggregate metrics wherever possible. Do not expose patients' raw symptom descriptions in overview charts.

### Facility management

Authorized administrators can create, edit, verify, deactivate and review facility records. Every change should record who made it, when it occurred and what was changed.

### Medical content management

Approved staff can manage medication references, safety messages, help content and emergency guidance. Content that affects triage or medical advice must have an explicit review and approval workflow. Do not let a generic administrator casually edit live emergency rules without clinical governance.

### User and audit management

Admins can manage accounts according to their permissions, investigate security issues and view audit events. Access to sensitive patient records should be restricted, justified and logged.

### Roles

- Super administrator: Manage platform configuration and privileged access.
- Clinical reviewer: Review approved medical content and safety rules.
- Facility manager: Maintain authorized facility data.
- Support administrator: Handle limited account support.
- Patient: Access only their own account and permitted records.

Role checks must be enforced by the backend for every protected operation.

## 13. Alerts, toasts, dialogs and inline messages

Clinix needs a consistent messaging system so that patients can distinguish a routine notification from a serious safety instruction.

Success toast

Example: “Assessment saved successfully.” Disappears after a short interval, with an accessible announcement.

Warning alert

Example: “Location access is unavailable. Enter your area to find clinics.” Remains visible until resolved or dismissed where appropriate.

Error message

Example: “We couldn't load your history. Your saved records have not been changed.” Includes a retry action when appropriate.

Urgent medical alert

Prominent, persistent and actionable. Must not rely on a disappearing toast, color alone or a dismiss button to communicate the urgency.

### Confirmation dialogs

Use dialogs for consequential actions such as deleting an assessment, removing a facility or deleting an account.

A confirmation dialog must explain:

- What action will happen.
- Whether it can be undone.
- What information will be affected.
- The confirm and cancel actions.

Do not use confirmation dialogs for every routine navigation action. Too many dialogs make the interface slower and less accessible.

### Message behavior rules

- Do not display sensitive symptom details in toasts.
- Prevent duplicate submissions during pending operations.
- Give every error a useful next step.
- Use inline validation for field-specific problems.
- Ensure messages can be read by assistive technology.
- Do not show a success message before the server confirms success.
- Do not use the same visual treatment for routine notices and emergencies.

## 14. API design and backend responsibilities

Use versioned, authenticated server endpoints with consistent response structures. The following are proposed contracts, not existing implemented endpoints.

| Endpoint                            | Purpose                                       |
| ----------------------------------- | --------------------------------------------- |
| `POST /api/v1/auth/register`        | Register a patient                            |
| `POST /api/v1/auth/login`           | Authenticate a user                           |
| `POST /api/v1/auth/logout`          | Revoke the active session                     |
| `POST /api/v1/auth/forgot-password` | Start password recovery                       |
| `POST /api/v1/auth/reset-password`  | Complete password recovery                    |
| `GET /api/v1/me`                    | Retrieve the current user's profile           |
| `PATCH /api/v1/me`                  | Update permitted profile fields               |
| `POST /api/v1/assessments`          | Create a symptom assessment                   |
| `GET /api/v1/assessments`           | List the current user's assessments           |
| `GET /api/v1/assessments/:id`       | Read an authorized assessment                 |
| `DELETE /api/v1/assessments/:id`    | Delete an assessment subject to policy        |
| `GET /api/v1/medications`           | Search approved medication data               |
| `GET /api/v1/medications/:id`       | Retrieve a medication record                  |
| `GET /api/v1/facilities`            | Search healthcare facilities                  |
| `GET /api/v1/facilities/:id`        | Retrieve facility details                     |
| `GET /api/v1/emergency-contacts`    | Retrieve verified local emergency information |
| `GET /api/v1/notifications`         | List permitted notifications                  |
| `GET /api/v1/admin/metrics`         | Retrieve authorized aggregate admin metrics   |

### Standard response structure

Successful response:

```
{
  "success": true,
  "data": {},
  "requestId": "server-generated-id"
}
```

Error response:

```
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please review the highlighted fields."
  },
  "requestId": "server-generated-id"
}
```

Never return stack traces, internal prompts, API keys, raw database errors or private provider responses to the browser.

### Assessment processing safeguards

The assessment endpoint should coordinate the following steps:

1. Authenticate the user when required.
2. Validate input and enforce size limits.
3. Apply rate limits and abuse protections.
4. Run safety screening.
5. Persist an assessment record with the appropriate consent and retention handling.
6. Call the NVIDIA model through a server-side service.
7. Validate the returned structure and safety constraints.
8. Store the permitted result and processing status.
9. Return a normalized response to the frontend.

Use an explicit processing status such as `pending`, `processing`, `completed` or `failed`. Prevent accidental duplicate assessments when a client retries after a timeout; use an idempotency mechanism where appropriate.

If an emergency rule fires, the response must prioritize the urgent instruction rather than wait for the model.

## 15. MongoDB data model

A practical initial set of collections is shown below.

| Collection              | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `users`                 | Account details, verification status and role             |
| `sessions`              | Server-managed session metadata and revocation            |
| `assessments`           | Symptom inputs, assessment status, result and timestamps  |
| `medications`           | Curated medication reference information and sources      |
| `facilities`            | Verified clinics, services, addresses and contact details |
| `emergencyContacts`     | Location-specific verified emergency information          |
| `notifications`         | User-facing account and service notices                   |
| `consents`              | Versioned consent records and changes                     |
| `auditLogs`             | Security-sensitive and administrative events              |
| `medicalContentReviews` | Review status, reviewer and publication history           |

### Example assessment document

```
{
  "userId": "user_object_id",
  "status": "completed",
  "input": {
    "symptoms": ["headache"],
    "duration": "less_than_24_hours",
    "severity": "moderate"
  },
  "result": {
    "urgency": "needs_review",
    "possibleExplanations": [],
    "recommendedNextSteps": [],
    "warningSigns": []
  },
  "modelMetadata": {
    "provider": "nvidia",
    "model": "configured-model-id",
    "promptVersion": "version-id"
  },
  "createdAt": "server-generated-timestamp",
  "updatedAt": "server-generated-timestamp"
}
```

This is an illustrative structure. The urgency enum and output schema must be defined and validated against clinician-approved safety requirements before implementation. Do not let the model invent its own urgency labels.

### Database rules

- Store passwords only as secure hashes.
- Use indexes for account lookup, user-owned assessment history, facility search and timestamps.
- Enforce ownership and roles on the server.
- Define retention and deletion policies before launch.
- Minimize sensitive information in audit logs.
- Encrypt data in transit and apply appropriate encryption at rest.
- Keep NVIDIA credentials and other secrets in server-side environment configuration.
- Avoid logging full prompts containing personal health information unless there is a justified, controlled need.
- Apply retention limits to backups and exported data as well as the primary database.

## 16. NVIDIA AI integration

The model should be treated as an untrusted information-generation component, not the authority that controls the application.

### Required server-side AI service

Create a dedicated module responsible for:

- Reading the configured provider endpoint and API key from environment variables.
- Selecting the approved model.
- Constructing a versioned prompt.
- Sending only necessary data.
- Enforcing request timeouts and output-token limits.
- Validating the returned JSON against a schema.
- Detecting missing or malformed fields.
- Recording safe operational metadata.
- Returning a normalized result or controlled error.

Suggested environment configuration:

```
NVIDIA_API_KEY=
NVIDIA_BASE_URL=
NVIDIA_MODEL=
MONGODB_URI=
AUTH_SECRET=
APP_BASE_URL=
```

Never commit populated secrets to source control or expose them using a `NEXT_PUBLIC_` environment variable.

### Failure handling

| Failure              | Behavior                                                                         |
| -------------------- | -------------------------------------------------------------------------------- |
| Provider timeout     | Preserve inputs and offer retry.                                                 |
| Rate limit           | Display a temporary availability message and respect retry guidance.             |
| Invalid JSON         | Reject the response; do not display it as trusted guidance.                      |
| Unsafe output        | Suppress the unsafe content and show the approved fallback.                      |
| Empty response       | Show a controlled error and a safe way to continue.                              |
| Provider unavailable | Show service unavailable; retain independently triggered emergency instructions. |

For production, clinical safety must be established through formal evaluation, monitoring, reviewed triage logic and ongoing governance—not merely a carefully written system prompt.

## 17. Accessibility and responsive behavior

Clinix must work for people with different abilities, devices, levels of digital literacy and network quality.

Accessibility requirements

- Target WCAG 2.2 AA.
- Use semantic headings, landmarks, labels and buttons.
- Support full keyboard navigation.
- Ensure visible focus indicators and sufficient color contrast.
- Never communicate urgency or errors using color alone.
- Announce loading completion and form errors to assistive technologies.
- Keep focus inside modal dialogs while open and restore focus when closed.
- Use clear, plain language rather than medical jargon wherever possible.
- Support text zoom without content clipping.
- Use sufficiently large touch targets.
- Respect reduced-motion preferences.

Responsive requirements

- Desktop: persistent sidebar and multi-column content.
- Tablet: collapsible sidebar and reduced columns.
- Mobile: compact header, accessible navigation drawer, stacked cards and full-width forms.
- Slow connection: minimize large assets and preserve form input during recoverable errors.

The emergency contact action must be easy to find on mobile without making it difficult to use the rest of the interface.

## 18. Security, privacy and clinical governance

Before a public launch, Clinix needs more than standard web-app security.

### Security controls

- Server-side authentication and role checks.
- Secure session cookies and session revocation.
- CSRF protection where applicable.
- Input validation, output encoding and protection against injection.
- Rate limiting on authentication, AI and sensitive endpoints.
- Secure password reset tokens.
- Access-controlled audit logging.
- Dependency and vulnerability scanning.
- Monitoring for unauthorized access and abnormal usage.
- A tested incident response and backup recovery process.

### Health-data privacy

Health information is highly sensitive. Define the legal basis for processing, consent requirements, retention periods, deletion procedures, data-sharing terms and any international transfers before launch. Assess applicable Ghanaian data-protection requirements and other laws in each market where Clinix operates.

Do not send identifiable patient data to an AI provider until the provider's data handling, retention and contractual arrangements have been reviewed.

### Clinical governance

Before enabling real patients:

1. Have qualified clinicians review triage rules, warning signs and fallback messages.
2. Validate the model against representative test cases.
3. Test urgent and ambiguous cases, including incomplete patient responses.
4. Document known limitations and escalation rules.
5. Establish a process for updating medical content.
6. Monitor incidents and provide a way to report unsafe output.
7. Conduct appropriate clinical, legal, privacy and security reviews.

Clinix should not be marketed as a substitute for medical professionals. Whether particular features qualify as regulated medical software depends on the product's intended use and target markets and requires expert review.

## 19. Testing and acceptance criteria

The implementation is not complete just because each page renders.

| Area               | Acceptance criterion                                                              |
| ------------------ | --------------------------------------------------------------------------------- |
| Navigation         | Every link opens the correct page, including direct URL navigation.               |
| Authentication     | Protected routes and APIs reject unauthorized requests.                           |
| Registration       | Invalid fields, duplicate accounts and server failures are handled correctly.     |
| Password recovery  | Reset tokens expire, are single-use and cannot reveal account existence.          |
| Symptom assessment | Input validation, back navigation, progress and saving work correctly.            |
| Emergency safety   | Critical warning cases bypass routine AI processing and show urgent instructions. |
| AI integration     | Timeouts, malformed responses and unsafe outputs are rejected safely.             |
| Medication search  | Verified sources are displayed and unknown medicines are not fabricated.          |
| Clinic search      | Manual location works without browser geolocation permission.                     |
| History            | Users cannot read or delete another user's records.                               |
| Alerts             | Success, warning, error and urgent messages have distinct behaviors.              |
| Mobile             | Forms, cards, dialogs and navigation remain usable on small screens.              |
| Accessibility      | Keyboard, screen-reader, zoom and contrast checks pass.                           |
| Privacy            | Sensitive health data is excluded from URLs and unnecessary logs.                 |
| Administration     | Each role can perform only its authorized actions.                                |
| Resilience         | Database, network and provider failures produce controlled recovery paths.        |

### Required automated test groups

- Unit tests for validation, safety rules and data-access logic.
- API integration tests for authorization and error handling.
- End-to-end tests for registration, assessment, saving and history.
- Safety regression tests for emergency scenarios.
- Accessibility tests for major pages and modal interactions.
- Load tests for high-demand endpoints.
- Security tests for IDOR, injection, session handling and rate limits.

Use synthetic or properly de-identified data for test environments.

## 20. Recommended implementation order

Build the application in stages so the UI, backend and safety requirements stay aligned.

1. Foundation and shared layout

   Set up Next.js, TypeScript, styling, reusable components, responsive navigation, error boundaries, loading skeletons and notification patterns.

2. Authentication and account settings

   Implement registration, login, logout, verification, recovery, session protection and role-based authorization.

3. Home dashboard and navigation

   Connect all cards and buttons to real routes. Implement empty states, search behavior and global feedback.

4. Symptom checker safety foundation

   Define the assessment schema, clinician-reviewed warning signs, emergency flow and deterministic rules before connecting the AI.

5. AI service integration

   Add the NVIDIA server-side client, response validation, failure handling, evaluation tests and safe result display.

6. Clinics, medications and emergency contacts

   Integrate verified data sources and implement search, filters, location permissions, calling and fallback states.

7. History, privacy and admin

   Add record ownership, consent management, audit logs, controlled administration and data retention.

8. Production readiness

   Complete security reviews, clinical validation, accessibility audits, monitoring, backup recovery and deployment checks.

## 21. Definition of done for every feature

Before marking any feature complete, verify that:

- Its UI matches the approved design system.
- All visible buttons and links perform the advertised action.
- Inputs have labels, validation and useful error messages.
- Loading, success, empty and failure states exist.
- API requests are authenticated and authorized as appropriate.
- Duplicate submissions are handled.
- Sensitive data is not exposed in logs or URLs.
- Mobile and keyboard interaction work.
- Tests cover the main path and failure cases.
- Medical functionality has the required review and safety controls.

Final requirement: Clinix must be a working application, not a collection of static screens. Each UI element must connect to its real frontend logic, backend endpoint, database operation or verified external service. Where a service has not yet been configured, show an honest unavailable state rather than fabricated results.
