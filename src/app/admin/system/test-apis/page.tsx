export const dynamic = 'force-dynamic';

export default function AdminTestApisPage() {
  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-xl lg:text-2xl font-semibold">Test APIs</h1>
      </div>
      <p className="text-sm text-gray-500">
        Connectivity checks for the external services this app depends on
        will live here.
      </p>
    </div>
  );
}
