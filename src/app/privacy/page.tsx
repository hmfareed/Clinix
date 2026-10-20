import { ShieldCheck, Lock, Eye, Trash2, Download, AlertCircle } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-8 dark:border-slate-800">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300">
          <ShieldCheck className="h-4 w-4" />
          <span>Ghana Data Protection Act (Act 843) Compliance</span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Privacy Notice & Data Retention Policy
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Version 1.0 — Effective Date: October 2026
        </p>
      </div>

      <div className="mt-8 space-y-8 text-sm text-slate-700 dark:text-slate-300">
        {/* Section 1 */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-teal-600" />
            1. Our Commitment to Your Health Data Privacy
          </h2>
          <p className="mt-2 leading-relaxed">
            Clinix treats all personal and health-related information as sensitive data under the Ghana Data
            Protection Act, 2012 (Act 843) and international best practices. We enforce strict data minimization:
            we collect only what is strictly necessary to assist you in assessing symptoms and navigating care.
          </p>
        </section>

        {/* Section 2: AI Disclosure */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Eye className="h-5 w-5 text-teal-600" />
            2. Disclosure of External AI Processing (NVIDIA NIM)
          </h2>
          <p className="mt-2 leading-relaxed">
            When you initiate a symptom assessment, your symptom text and non-identifying clinical indicators
            (such as age category) are transmitted to a dedicated, enterprise-grade AI inference service
            (NVIDIA NIM).
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <ul className="list-disc list-inside space-y-1">
              <li><strong>What is sent:</strong> Symptom description, duration, patient-reported severity, age bracket.</li>
              <li><strong>What is NEVER sent:</strong> Your name, email, phone number, account ID, or exact GPS coordinates.</li>
            </ul>
          </div>
        </section>

        {/* Section 3: Retention Schedule */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            3. Data Retention Schedule
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800/60 font-semibold text-slate-900 dark:text-white">
                <tr>
                  <th className="p-3">Data Category</th>
                  <th className="p-3">Guest Mode</th>
                  <th className="p-3">Registered Patient</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <tr>
                  <td className="p-3 font-medium">Assessment Messages & Transcript</td>
                  <td className="p-3 text-teal-600 font-semibold">24-Hour Automated TTL Deletion</td>
                  <td className="p-3">Retained in user history until deleted</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Structured Assessment Results</td>
                  <td className="p-3">Not stored permanently</td>
                  <td className="p-3">User-managed</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Consent Records</td>
                  <td className="p-3">Minimal audit record</td>
                  <td className="p-3">Retained for legal verification</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">GPS / Location Coordinates</td>
                  <td className="p-3">Never stored (transient lookup only)</td>
                  <td className="p-3">Never stored (transient lookup only)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Rights */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            4. Your Rights Under Ghana Act 843
          </h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Download className="h-4 w-4 text-teal-600" /> Right to Data Export
              </h3>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                Registered patients can export a complete machine-readable copy of their health records and
                assessments at any time.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Trash2 className="h-4 w-4 text-red-600" /> Right to Erasure
              </h3>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                You can delete your account and all associated health history permanently with immediate
                revocation.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
