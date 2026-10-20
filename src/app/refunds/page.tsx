import LegalPage from "@/components/LegalPage";
import { REFUNDS } from "@/lib/legal/docs";

export const metadata = { title: `${REFUNDS.title} · Listing Copilot` };

export default function Page() {
  return <LegalPage doc={REFUNDS} />;
}
