# 08 — Nearby Clinics, Hospitals and Pharmacies

Use a mapping or places API. **Never** ask the AI to invent nearby businesses.

## User flow

1. Patient chooses **Find nearby care**
2. App requests location permission or accepts a manually entered town or area
3. Backend determines the search radius
4. Maps/places provider returns relevant facilities
5. App displays facility info, distance, directions and contact options
6. Patient opens details or navigates

## Facility card

```
Facility name
Facility type · approximate distance
Address and verified contact information
[Directions]  [Call facility]
Source · last verified · hours: known/unknown
```

## Required functionality

- Search hospitals, clinics, pharmacies and emergency departments
- Search by current location or manual location
- Distance and directions
- Call buttons for verified telephone numbers
- Filter by facility type and relevant services
- Display source and last-verified timestamp
- Clearly show when opening hours or service availability are unknown
- Let patients correct or report inaccurate information
- Never promise a facility has a doctor, medicine or ambulance available unless verified by an appropriate source

## Integration options

- Google Maps Platform Places API and Maps URLs
- Mapbox Search and Directions APIs
- An official or licensed Ghanaian healthcare-facility directory, where available

## Rules

- Use browser geolocation only after permission. A **manual location selector is essential** for the first release.
- Do **not** send the symptom transcript to a mapping provider. Send only location and the minimum needed to search.
- Cache results in `facilitiesCache` with source and verification metadata (see [11](11-database-design.md)); respect provider caching terms.
- If the provider is down, show emergency numbers and a manual "search on your map app" link instead of an empty screen.

## Facility result shape (new)

```ts
type Facility = {
  providerId: string;
  name: string;
  type: "hospital" | "clinic" | "pharmacy" | "emergency_department";
  location: { lat: number; lng: number };
  address?: string;
  phone?: string;
  phoneVerified: boolean;
  hours?: { known: boolean; text?: string };
  source: string;
  lastVerifiedAt?: string; // ISO date
  distanceKm?: number;
};
```
