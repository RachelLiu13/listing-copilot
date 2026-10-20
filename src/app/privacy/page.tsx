import LegalPage from "@/components/LegalPage";
import { PRIVACY } from "@/lib/legal/docs";

export const metadata = { title: `${PRIVACY.title} · Listing Copilot` };

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
