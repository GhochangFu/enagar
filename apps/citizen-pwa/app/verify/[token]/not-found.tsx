export default function NotFound() {
  return (
    <main className="max-w-md mx-auto p-6 space-y-2" data-testid="verify-not-found">
      <h1 className="text-xl font-semibold">Receipt not in our records</h1>
      <p className="text-sm text-gray-600">
        The receipt number you scanned could not be verified. Please contact the issuing office if
        you believe this is a mistake.
      </p>
    </main>
  );
}
