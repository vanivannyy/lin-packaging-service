import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, SubmitButton } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/roles";
import type { UserRole } from "@prisma/client";
import { createUserAction, toggleUserActiveAction } from "./actions";
import { requireModule } from "@/lib/require-session";

const ROLES: UserRole[] = ["OWNER", "SALES_MANAGER", "SALES", "FINANCE", "WAREHOUSE", "QC", "PURCHASING", "PRODUCTION_PLANNER"];

export default async function UserRolePage() {
  await requireModule("user-role");
  const users = await prisma.user.findMany({ where: { isDeleted: false }, orderBy: { code: "asc" } });

  return (
    <div>
      <PageHeader
        eyebrow="Sistem"
        title="User & Role"
        actions={
          <Modal
            title="Tambah User Baru"
            trigger={
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Plus size={15} /> User Baru
              </button>
            }
          >
            <form action={createUserAction} className="space-y-3">
              <Field label="Nama Lengkap">
                <Input name="name" required placeholder="Budi Santoso" />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" required placeholder="user@lin-packaging.com" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Departemen">
                  <Input name="department" placeholder="Sales" />
                </Field>
                <Field label="Posisi">
                  <Input name="position" placeholder="Sales Executive" />
                </Field>
              </div>
              <Field label="Role">
                <Select name="role" defaultValue="SALES">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Password">
                <Input name="password" type="password" required minLength={6} placeholder="Minimal 6 karakter" />
              </Field>
              <SubmitButton>Simpan User</SubmitButton>
            </form>
          </Modal>
        }
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Kode</Th>
              <Th>Nama</Th>
              <Th>Email</Th>
              <Th>Departemen</Th>
              <Th>Posisi</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Login Terakhir</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {users.length === 0 ? (
              <EmptyRow colSpan={9} />
            ) : (
              users.map((u) => (
                <Tr key={u.id}>
                  <Td className="font-medium text-blue-600">{u.code}</Td>
                  <Td className="font-medium text-gray-900">{u.name}</Td>
                  <Td>{u.email}</Td>
                  <Td>{u.department ?? "-"}</Td>
                  <Td>{u.position ?? "-"}</Td>
                  <Td>
                    <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                      {ROLE_LABEL[u.role]}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={u.isActive ? "ACTIVE" : "INACTIVE"} />
                  </Td>
                  <Td className="text-gray-400">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "-"}</Td>
                  <Td>
                    <form action={toggleUserActiveAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                        {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </form>
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
