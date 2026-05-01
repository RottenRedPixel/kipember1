import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function formatJoinedDate(date: Date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      createdAt: true,
      _count: { select: { ownedImages: true } },
    },
  });

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-xl lg:text-2xl font-semibold">Users</h1>
        <span className="text-xs text-gray-500 tabular-nums">
          {users.length} {users.length === 1 ? 'user' : 'users'}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium tabular-nums">Embers</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
              return (
                <tr key={u.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3">{name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.phoneNumber || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{u._count.ownedImages}</td>
                  <td className="px-4 py-3 text-gray-500">{formatJoinedDate(u.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No users yet.</div>
        ) : null}
      </div>
    </div>
  );
}
