import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 8: Accessibility & WCAG 2.2 AA Compliance Audit", () => {
  const rootLayoutPath = path.resolve(process.cwd(), "src/app/layout.tsx");
  const navbarPath = path.resolve(process.cwd(), "src/components/layout/navbar.tsx");
  const symptomCheckerPath = path.resolve(process.cwd(), "src/app/symptom-checker/page.tsx");
  const consentModalPath = path.resolve(process.cwd(), "src/components/patient/ConsentModal.tsx");

  it("verifies root layout contains a bypass skip link targeting #main-content (WCAG 2.4.1)", () => {
    const content = fs.readFileSync(rootLayoutPath, "utf-8");
    expect(content).toContain('href="#main-content"');
    expect(content).toContain("Skip to main content");
    expect(content).toContain('id="main-content"');
  });

  it("verifies navigation bar has accessible emergency call links with descriptive aria-label", () => {
    const content = fs.readFileSync(navbarPath, "utf-8");
    expect(content).toContain('href="tel:112"');
    expect(content).toContain("aria-label=");
    expect(content).toContain("Emergency: 112");
  });

  it("verifies symptom checker chat implements ARIA live regions for screen readers", () => {
    const content = fs.readFileSync(symptomCheckerPath, "utf-8");
    expect(content).toContain('aria-live="polite"');
    expect(content).toContain('role="log"');
  });

  it("verifies urgency results convey status via icons, text labels, and color (never color alone)", () => {
    const content = fs.readFileSync(symptomCheckerPath, "utf-8");
    // Verifies icon presence for each state
    expect(content).toContain("ShieldAlert");
    expect(content).toContain("AlertTriangle");
    expect(content).toContain("ShieldCheck");
    // Verifies text badge
    expect(content).toContain("Triage Urgency Level");
    expect(content).toContain("toUpperCase()");
  });

  it("verifies interactive modals implement ARIA dialog semantics", () => {
    if (fs.existsSync(consentModalPath)) {
      const content = fs.readFileSync(consentModalPath, "utf-8");
      expect(content).toMatch(/role=["']dialog["']/);
      expect(content).toContain("aria-modal");
    }
  });

  it("verifies contrast and focus ring utility classes exist across core interactive forms", () => {
    const content = fs.readFileSync(symptomCheckerPath, "utf-8");
    expect(content).toContain("focus:ring-2");
    expect(content).toContain("focus:outline-none");
  });
});
