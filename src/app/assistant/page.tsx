import { ClinixAssistant } from "@/components/assistant/clinix-assistant";

export const metadata = {
  title: "AI Health Assistant | Clinix",
  description:
    "Interactive healthcare information, structured symptom guidance, medication safety, and care navigation assistant.",
};

export default function AssistantPage() {
  return <ClinixAssistant />;
}
