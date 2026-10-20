import NewListingForm from "./NewListingForm";

export const metadata = { title: "New listing · Listing Copilot" };

export default function NewListingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">New listing</h1>
      <p className="mt-1 text-sm text-slate-500">Write in any language: Chinese, Vietnamese, Spanish, English, or a mix. The listing is written in the marketplace&apos;s language; the review is explained in yours. The more facts you give, the better it is, and nothing you did not say will be claimed.</p>
      <div className="mt-8"><NewListingForm /></div>
    </main>
  );
}
