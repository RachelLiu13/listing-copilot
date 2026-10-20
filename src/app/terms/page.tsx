import LegalPage from "@/components/LegalPage";
import { TERMS } from "@/lib/legal/docs";

export const metadata = { title: `${TERMS.title} · Listing Copilot` };

export default function Page() {
  return <LegalPage doc={TERMS} />;
}
