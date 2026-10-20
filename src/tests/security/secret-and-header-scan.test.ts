import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import nextConfig from "../../../next.config";

describe("Phase 8: Security Headers, Secret Scanning & Safe Defaults", () => {
  describe("Security Headers (next.config.ts)", () => {
    it("configures all mandatory healthcare security headers per specifications 15 & 18", async () => {
      expect(typeof nextConfig.headers).toBe("function");
      const headersConfig = await nextConfig.headers!();

      expect(Array.isArray(headersConfig)).toBe(true);
      const wildcardRoute = headersConfig.find((r) => r.source === "/(.*)");
      expect(wildcardRoute).toBeDefined();

      const headersMap = new Map<string, string>();
      for (const h of wildcardRoute!.headers) {
        headersMap.set(h.key, h.value);
      }

      // 1. Content Security Policy
      expect(headersMap.has("Content-Security-Policy")).toBe(true);
      const csp = headersMap.get("Content-Security-Policy")!;
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("https://integrate.api.nvidia.com");

      // 2. Clickjacking protection (X-Frame-Options)
      expect(headersMap.get("X-Frame-Options")).toBe("DENY");

      // 3. MIME-type sniffing protection
      expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");

      // 4. Referrer Policy
      expect(headersMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");

      // 5. Permissions Policy (restricting camera/mic, scoping geolocation)
      expect(headersMap.get("Permissions-Policy")).toContain("camera=()");
      expect(headersMap.get("Permissions-Policy")).toContain("microphone=()");
      expect(headersMap.get("Permissions-Policy")).toContain("geolocation=(self)");

      // 6. Strict-Transport-Security (HSTS)
      const hsts = headersMap.get("Strict-Transport-Security");
      expect(hsts).toBeDefined();
      expect(hsts).toContain("max-age=63072000");
      expect(hsts).toContain("includeSubDomains");
      expect(hsts).toContain("preload");
    });
  });

  describe("Secret Scanning & Environmental Integrity", () => {
    it("verifies .env.example contains only dummy placeholders and zero real secrets", () => {
      const envExamplePath = path.resolve(process.cwd(), ".env.example");
      expect(fs.existsSync(envExamplePath)).toBe(true);
      const content = fs.readFileSync(envExamplePath, "utf-8");

      // Check for placeholder patterns
      expect(content).toContain("your_nvidia_api_key_here");
      expect(content).toContain("your_resend_api_key_here");
      expect(content).toContain("changeme_in_production");

      // Ensure no live/real connection strings or API keys are embedded
      expect(content).not.toMatch(/mongodb\+srv:\/\/[^:]+:[^@]+@/);
      expect(content).not.toMatch(/nvapi-[a-zA-Z0-9_-]{30,}/);
      expect(content).not.toMatch(/re_[a-zA-Z0-9_-]{20,}/);
    });

    it("verifies no NEXT_PUBLIC_ variables expose server-side secrets or credentials in application code", () => {
      // Find all source files under src/ (excluding tests)
      const srcDir = path.resolve(process.cwd(), "src");
      const files: string[] = [];

      function getFiles(dir: string) {
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            if (file !== "tests") {
              getFiles(filePath);
            }
          } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
            files.push(filePath);
          }
        }
      }

      getFiles(srcDir);

      const dangerousNames = [
        "NEXT_PUBLIC_NVIDIA",
        "NEXT_PUBLIC_SECRET",
        "NEXT_PUBLIC_PASSWORD",
        "NEXT_PUBLIC_KEY",
        "NEXT_PUBLIC_MONGO",
        "NEXT_PUBLIC_RESEND",
        "NEXT_PUBLIC_TOKEN",
        "NEXT_PUBLIC_AUTH_SECRET",
      ];

      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        for (const badVar of dangerousNames) {
          expect(
            content.includes(badVar),
            `Security violation: Found dangerous exposure '${badVar}' in ${file}`
          ).toBe(false);
        }
      }
    });

    it("verifies source files do not contain hardcoded private keys or live credentials", () => {
      const srcDir = path.resolve(process.cwd(), "src");
      const files: string[] = [];

      function getFiles(dir: string) {
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            if (file !== "tests") {
              getFiles(filePath);
            }
          } else if (file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".json")) {
            files.push(filePath);
          }
        }
      }

      getFiles(srcDir);

      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        expect(content).not.toContain("BEGIN RSA PRIVATE KEY");
        expect(content).not.toContain("BEGIN PRIVATE KEY");
        expect(content).not.toContain("BEGIN OPENSSH PRIVATE KEY");
        // Ensure no hardcoded MongoDB connection passwords
        expect(content).not.toMatch(/mongodb\+srv:\/\/[a-zA-Z0-9]+:[a-zA-Z0-9]+@/);
      }
    });
  });
});
