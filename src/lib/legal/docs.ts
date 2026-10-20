/**
 * Terms, privacy and refund policies. Plain data so the pages stay simple and
 * the text is reviewable in one place. Contact address = the sending address.
 */
export interface LegalDoc { title: string; updated: string; sections: { heading: string; body: string[] }[] }

const UPDATED = "October 19, 2026";
export const CONTACT = "rachelliu1113@gmail.com";

export const TERMS: LegalDoc = {
  title: "Terms of Service",
  updated: UPDATED,
  sections: [
    { heading: "1. The service", body: ["Listing Copilot (\"we\", \"the service\") helps marketplace sellers draft product listings and review them for wording that may break marketplace policies. By creating an account or using the service you agree to these terms."] },
    { heading: "2. Your account", body: ["You must give a valid email address and keep your password safe. You are responsible for activity under your account. One person or business per account; do not create accounts to obtain extra free credits."] },
    { heading: "3. AI output is a draft, not advice", body: [
      "Listings, risk scores, explanations and appeal drafts are produced by automated systems, including large language models, and can be wrong or incomplete. They are suggestions, not legal, regulatory or compliance advice.",
      "You are responsible for everything you publish on a marketplace and for every claim you make about your product. Review each listing before publishing it, and only claim what is true and what you can prove. We do not guarantee that a listing will be accepted, will stay online, or will sell.",
    ] },
    { heading: "4. Your content", body: ["You keep the rights to the product information you enter and to the listings generated for you, and you give us permission to process it to provide the service. Do not enter content you have no right to use, other people's personal data, or anything unlawful."] },
    { heading: "5. Acceptable use", body: ["Do not use the service to write misleading or unlawful product claims on purpose, to infringe others' trademarks or copyrights, to attack or overload the service, or to resell access to it. We may limit usage (including the fair-use limit of 300 AI requests in any 30 days) and may suspend accounts that break these terms."] },
    { heading: "6. Credits, subscriptions and payment", body: [
      "Paid credits and the Pro subscription are sold through Stripe. Prices are shown before you pay. Credits do not expire while your account is open and have no cash value. Pro renews monthly until cancelled; you can cancel at any time from your Account page and keep Pro until the end of the period you paid for.",
      "Refunds are described in our Refund Policy.",
    ] },
    { heading: "7. Availability and changes", body: ["We work to keep the service available but do not promise it will be uninterrupted or error-free. We may change or discontinue features. If we change these terms in a material way, we will update the date above and, where appropriate, tell you by email or in the app."] },
    { heading: "8. Liability", body: ["To the extent the law allows, the service is provided \"as is\", and our total liability for any claim relating to the service is limited to the amount you paid us in the 3 months before the claim. We are not liable for lost sales, suspended listings or marketplace account actions."] },
    { heading: "9. Ending your account", body: ["You can delete your account at any time from the Account page. We may close accounts that break these terms. Sections 3, 4 and 8 continue to apply after your account ends."] },
    { heading: "10. Contact", body: [`Questions about these terms: ${CONTACT}.`] },
  ],
};

export const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  updated: UPDATED,
  sections: [
    { heading: "What we collect", body: [
      "Account: your email address and a hashed password (handled by our authentication provider). Content: the product notes, listings, documents you list in the evidence library, and takedown notices you paste. Product photos are processed once and not stored.",
      "Usage: which features you use, when, and how many AI tokens they used, so we can enforce limits and control costs. Payments: Stripe processes your card; we receive only the payment status, amount and a customer reference, never your card number.",
      "A cookie keeps you signed in, and another remembers your interface language. We do not use advertising or tracking cookies.",
    ] },
    { heading: "How we use it", body: ["To provide the service (generate, review and store your listings), to keep your account secure, to enforce fair-use limits, to process payments, and to send you account emails such as verification codes and password resets. We do not sell your data and do not use it for advertising."] },
    { heading: "Who processes it for us", body: [
      "Supabase (authentication and database), Vercel (hosting), Anthropic (the Claude AI model that processes the product information you submit), Stripe (payments), Amazon's public search suggestions (we send product keywords, not personal data), and Google (sending account emails).",
      "These providers process data only to provide their service to us. Under Anthropic's commercial terms, content sent through the API is not used to train their models.",
    ] },
    { heading: "How long we keep it", body: ["We keep your content while your account is open. When you delete your account, your listings, documents, appeals and usage records are deleted immediately. Payment records are kept, without your account link, as required for accounting."] },
    { heading: "Your rights", body: ["You can download all your data (Account → Download my data) and delete your account (Account → Delete account) at any time. You can also contact us to access, correct or delete your information. Depending on where you live (for example under the GDPR or the CCPA), you may have further rights, including to object to processing or to complain to a data protection authority."] },
    { heading: "Security", body: ["Data is encrypted in transit, each user can read only their own records (database row-level security), and secret keys stay on the server. No system is perfectly secure; tell us at once if you think your account was misused."] },
    { heading: "Children", body: ["The service is for businesses and is not directed at children under 16."] },
    { heading: "Contact", body: [`Privacy questions or requests: ${CONTACT}.`] },
  ],
};

export const REFUNDS: LegalDoc = {
  title: "Refund Policy",
  updated: UPDATED,
  sections: [
    { heading: "Failed generations are never charged", body: ["If a listing, audit or appeal fails for any reason after a credit was used, the credit is returned automatically. Follow-up questions asked before writing are free."] },
    { heading: "Credit packs", body: ["If you have not used any credits from a pack, you can ask for a full refund within 14 days of purchase. Once credits from a pack have been used, the pack is not refundable. Credits do not expire while your account is open."] },
    { heading: "Pro subscription", body: ["You can cancel Pro at any time from Account → Manage subscription. Cancelling stops the next renewal; you keep Pro until the end of the period you already paid for. We do not give partial refunds for the remaining days of a period, except where the law requires it."] },
    { heading: "Problems with a charge", body: [`If you were charged by mistake, charged twice, or the service did not work as described, contact ${CONTACT} within 30 days with your account email and the date of the charge, and we will put it right.`] },
  ],
};
