import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/roles";
import { requireModule } from "@/lib/require-session";

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireModule("audit-trail");
  const { q } = await searchParams;

  const logs = await prisma.auditTrail.findMany({
    where: q
      ? {
          OR: [
            { referenceCode: { contains: q, mode: "insensitive" } },
            { module: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Sistem"
        title="Audit Trail"
        actions={
          <form className="relative">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Cari log..."
              className="w-56 rounded-md border border-gray-200 py-2 px-3 text-sm outline-none focus:border-blue-400"
            />
          </form>
        }
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Waktu</Th>
              <Th>User</Th>
              <Th>Role</Th>
              <Th>Modul</Th>
              <Th>Aksi</Th>
              <Th>Referensi</Th>
              <Th>Nilai Lama</Th>
              <Th>Nilai Baru</Th>
            </tr>
          </Thead>
          <Tbody>
            {logs.length === 0 ? (
              <EmptyRow colSpan={8} />
            ) : (
              logs.map((log) => (
                <Tr key={log.id}>
                  <Td className="text-gray-500">{formatDateTime(log.createdAt)}</Td>
                  <Td className="font-medium text-gray-900">{log.user?.name ?? "System"}</Td>
                  <Td>
                    {log.user ? (
                      <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                        {ROLE_LABEL[log.user.role]}
                      </span>
                    ) : (
                      "-"
                    )}
                  </Td>
                  <Td className="lowercase">{log.module}</Td>
                  <Td>
                    <span className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                      {log.action}
                    </span>
                  </Td>
                  <Td className="text-blue-600">{log.referenceCode ?? "-"}</Td>
                  <Td className="max-w-[160px] truncate text-xs text-gray-400">
                    {log.oldValue ? JSON.stringify(log.oldValue) : "-"}
                  </Td>
                  <Td className="max-w-[160px] truncate text-xs text-gray-500">
                    {log.newValue ? JSON.stringify(log.newValue) : "-"}
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
