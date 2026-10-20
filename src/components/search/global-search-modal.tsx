"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Stethoscope, Pill, MapPin, PhoneCall, X, ArrowRight } from "lucide-react";

interface SearchResultItem {
  id: string;
  title: string;
  category: "symptom" | "medication" | "clinic" | "emergency";
  subtitle: string;
  href: string;
}

const SEARCH_DATABASE: SearchResultItem[] = [
  // Symptoms
  { id: "s-1", title: "Headache / Migraine", category: "symptom", subtitle: "Throbbing head pain, tension or visual aura", href: "/symptom-checker" },
  { id: "s-2", title: "Fever & Chills", category: "symptom", subtitle: "Elevated temperature, malaria screening or viral infection", href: "/symptom-checker" },
  { id: "s-3", title: "Chest Pain & Pressure", category: "emergency", subtitle: "EMERGENCY: Immediate medical evaluation required", href: "/emergency" },
  { id: "s-4", title: "Persistent Cough", category: "symptom", subtitle: "Dry or productive cough, respiratory check", href: "/symptom-checker" },
  { id: "s-5", title: "Abdominal Pain", category: "symptom", subtitle: "Stomach cramps, nausea or digestive distress", href: "/symptom-checker" },
  
  // Medications
  { id: "m-1", title: "Paracetamol (Acetaminophen)", category: "medication", subtitle: "Analgesic & antipyretic for pain and fever", href: "/medications" },
  { id: "m-2", title: "Amoxicillin", category: "medication", subtitle: "Prescription penicillin antibiotic (POM)", href: "/medications" },
  { id: "m-3", title: "Artemether + Lumefantrine (Coartem)", category: "medication", subtitle: "First-line ACT antimalarial in Ghana", href: "/medications" },
  { id: "m-4", title: "Oral Rehydration Salts (ORS)", category: "medication", subtitle: "Essential fluid & electrolyte replenishment", href: "/medications" },
  { id: "m-5", title: "Ibuprofen", category: "medication", subtitle: "NSAID anti-inflammatory and pain reliever", href: "/medications" },

  // Clinics
  { id: "c-1", title: "Korle Bu Teaching Hospital", category: "clinic", subtitle: "National tertiary referral center — Accra", href: "/clinics" },
  { id: "c-2", title: "Greater Accra Regional Hospital (Ridge)", category: "clinic", subtitle: "24/7 public emergency hospital — Ridge, Accra", href: "/clinics" },
  { id: "c-3", title: "Komfo Anokye Teaching Hospital (KATH)", category: "clinic", subtitle: "Tertiary regional teaching hospital — Kumasi", href: "/clinics" },
  { id: "c-4", title: "Tema General Hospital", category: "clinic", subtitle: "District referral and maternity center — Tema", href: "/clinics" },
  
  // Emergency
  { id: "e-1", title: "National Ambulance Service (112)", category: "emergency", subtitle: "Free nationwide emergency medical dispatch", href: "tel:112" },
  { id: "e-2", title: "Ghana Police Emergency (191)", category: "emergency", subtitle: "National security & police emergency response", href: "tel:191" },
];

export function GlobalSearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Keyboard shortcut Ctrl+K / Cmd+K listener
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = query.trim()
    ? SEARCH_DATABASE.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_DATABASE.slice(0, 8);

  function handleSelect(item: SearchResultItem) {
    onClose();
    if (item.href.startsWith("tel:")) {
      window.location.href = item.href;
    } else {
      router.push(item.href);
    }
  }

  function getCategoryIcon(category: SearchResultItem["category"]) {
    switch (category) {
      case "symptom":
        return <Stethoscope className="h-4 w-4 text-blue-400" />;
      case "medication":
        return <Pill className="h-4 w-4 text-sky-400" />;
      case "clinic":
        return <MapPin className="h-4 w-4 text-emerald-400" />;
      case "emergency":
        return <PhoneCall className="h-4 w-4 text-red-400" />;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/85 backdrop-blur-md p-4 pt-20 sm:pt-24 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global search dialog"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-zinc-800 px-4">
          <Search className="h-5 w-5 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent px-4 py-4 text-sm text-white placeholder-zinc-500 focus:outline-none"
            placeholder="Search symptoms, medications, clinics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              aria-label="Clear query"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-400">
              <p className="font-semibold text-zinc-200">
                No matching health resources found
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Try searching for general symptoms (e.g. fever, headache), medications, or Ghanaian hospitals.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                {query ? "Matching Resources" : "Suggested Shortcuts"}
              </div>
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-zinc-900 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 shadow-xs">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-blue-400 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-900 bg-black px-4 py-2.5 text-[11px] text-zinc-500">
          <span>Search Clinix healthcare directory & AI tools</span>
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-400">
              ↵
            </kbd>
            <span>to open</span>
          </div>
        </div>
      </div>
    </div>
  );
}
