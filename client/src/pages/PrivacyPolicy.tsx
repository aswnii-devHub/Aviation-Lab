// @ts-nocheck
// This page displays the privacy policy of the Aviation Exam Generator application.
export default function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-gray-800">
      <h1 className="mb-3 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-gray-500">
        Last updated: October 31, 2026
      </p>

      <p className="mb-6">
        Aviation Exam Generator helps users analyze aviation study materials,
        generate practice questions, and create Google Forms. This Privacy
        Policy explains how information is processed when you use our website.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        1. Information We Process
      </h2>
      <p className="mb-3">
        Depending on the features you use, we may process:
      </p>
      <ul className="mb-6 list-disc space-y-2 pl-6">
        <li>PDF documents and aviation study materials you upload.</li>
        <li>Extracted text and content used to generate practice questions.</li>
        <li>Questions, answers, and other content generated through the application.</li>
        <li>
          Google account information made available through the permissions
          you grant when connecting your Google account.
        </li>
        <li>Information required to create and manage Google Forms.</li>
      </ul>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        2. How We Use Your Information
      </h2>
      <p className="mb-3">We use the information processed to:</p>
      <ul className="mb-6 list-disc space-y-2 pl-6">
        <li>Analyze uploaded aviation study materials.</li>
        <li>Generate practice questions and explanations using AI.</li>
        <li>Allow users to preview and organize generated questions.</li>
        <li>Create Google Forms in the connected user's Google account.</li>
        <li>Operate, maintain, and improve the application.</li>
      </ul>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        3. AI Processing
      </h2>
      <p className="mb-6">
        Uploaded documents or extracted text may be sent to Google's Gemini
        API for content analysis and question generation. Information
        submitted to that service is also subject to Google's applicable
        policies and terms. Please avoid uploading confidential or sensitive
        information.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        4. Google Account and Google Forms
      </h2>
      <p className="mb-3">
        You may optionally connect your Google account to use the Google Forms
        integration. If you choose to connect:
      </p>
      <ul className="mb-6 list-disc space-y-2 pl-6">
        <li>
          Google will ask you to authorize the permissions requested by the
          application.
        </li>
        <li>
          We use the granted permissions to create Google Forms on your behalf.
        </li>
        <li>
          Forms created through the integration are associated with your
          Google account.
        </li>
        <li>
          We do not ask for or receive your Google account password.
        </li>
      </ul>
      <p className="mb-6">
        You can manage or revoke the application's access through your
        Google Account security settings.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        5. Data Storage and Retention
      </h2>
      <p className="mb-6">
        The application may temporarily process uploaded documents and
        extracted content to provide its features. Certain application
        records, such as generated question history or form-related
        information, may be stored by the application. We retain information
        only as needed to operate the features, maintain records, and address
        technical issues. Actual retention may depend on the feature used
        and the hosting environment.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        6. Third-Party Services
      </h2>
      <p className="mb-3">
        Aviation Exam Generator uses third-party services to provide its
        functionality, including:
      </p>
      <ul className="mb-6 list-disc space-y-2 pl-6">
        <li>Google OAuth for account authorization.</li>
        <li>Google Forms API for form creation.</li>
        <li>Google Gemini API for AI-powered content processing.</li>
        <li>Vercel and Render for application hosting.</li>
      </ul>
      <p className="mb-6">
        These services process information according to their respective
        privacy policies and terms.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        7. Data Security
      </h2>
      <p className="mb-6">
        We take reasonable measures to protect information processed by the
        application. However, no internet-based service can guarantee
        absolute security.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        8. Your Choices
      </h2>
      <p className="mb-6">
        You can choose whether to upload documents or connect a Google
        account. You can also revoke Google account access through your
        Google Account settings.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        9. Children's Privacy
      </h2>
      <p className="mb-6">
        This application is not intended to be directed at children under
        the age of 13. We do not knowingly seek to collect personal
        information from children.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">
        10. Changes to This Policy
      </h2>
      <p className="mb-6">
        We may update this Privacy Policy as the application evolves.
        Updated versions will be published on this page.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">11. Contact</h2>
      <p>
        If you have questions about this Privacy Policy, contact us at:
        {" "}
        <a
          className="text-blue-600 underline"
          href="mailto:aswani.gundu@gmail.com"
        >
          aswani.gundu@gmail.com
        </a>
      </p>
    </main>
  );
}