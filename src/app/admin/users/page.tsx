import { listSessions } from "@/server/sessions";
import { ADMIN_ERRORS, listUsers, type AdminAction, type User } from "@/server/users";
import { requireAdminPage } from "@/server/viewer";

export const metadata = { title: "강사 관리 · Nova Lab" };

const dateFmt = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });

const STATUS: Record<User["status"], [string, string]> = {
  pending: ["승인 대기", "text-brand"],
  active: ["사용 중", "text-body"],
  disabled: ["정지", "text-alert"],
};

function ActionButton({ id, action, label, tone = "plain" }: { id: string; action: AdminAction; label: string; tone?: "primary" | "plain" | "danger" }) {
  const cls = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    plain: "border border-line text-ink hover:bg-side",
    danger: "border border-line text-alert hover:bg-side",
  }[tone];
  return (
    <form action={`/api/admin/users/${id}`} method="post">
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={`h-8 rounded-lg px-3 text-[13px] font-medium ${cls}`}>
        {label}
      </button>
    </form>
  );
}

export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  const viewer = await requireAdminPage();
  const sp = await props.searchParams;
  const code = typeof sp.error === "string" ? sp.error : "";
  const error = code in ADMIN_ERRORS ? ADMIN_ERRORS[code as keyof typeof ADMIN_ERRORS] : "";

  const users = await listUsers();
  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");
  const counts = new Map<string, number>();
  for (const s of await listSessions(viewer)) if (s.ownerId) counts.set(s.ownerId, (counts.get(s.ownerId) ?? 0) + 1);

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">강사 관리</h1>
      <p className="mt-2 text-[14px] text-sub">가입 신청을 승인하고, 계정을 정지하거나 운영진으로 지정해요. 운영진은 모든 강사의 녹화와 피드백을 볼 수 있어요.</p>
      {viewer.local && (
        <p className="mt-4 text-[13px] text-ter">지금은 로그인 없이 이 컴퓨터에서 연 로컬 관리자 모드예요(LOCAL_NO_LOGIN).</p>
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-alert/30 px-3.5 py-3 text-[13.5px] text-alert">
          {error}
        </p>
      )}

      <section className="mt-10" aria-labelledby="pending-h">
        <h2 id="pending-h" className="text-[17px] font-semibold text-ink">
          승인 대기 <span className="tnum ml-1 text-ter">{pending.length}</span>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-4 text-[14px] text-sub">새 가입 신청이 없어요.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {pending.map((u) => (
              <li key={u.id} className="flex items-center gap-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-ink">{u.name}</p>
                  <p className="mt-0.5 text-[13px] text-sub">
                    {u.email}
                    <span className="ml-3 text-ter">{dateFmt.format(new Date(u.createdAt))} 신청</span>
                  </p>
                </div>
                <ActionButton id={u.id} action="approve" label="승인" tone="primary" />
                <ActionButton id={u.id} action="disable" label="거절" tone="danger" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="all-h">
        <h2 id="all-h" className="text-[17px] font-semibold text-ink">
          전체 계정 <span className="tnum ml-1 text-ter">{others.length}</span>
        </h2>
        {others.length === 0 ? (
          <p className="mt-4 text-[14px] text-sub">아직 승인된 계정이 없어요.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[12.5px] text-ter">
                <th className="py-3 font-medium">이름</th>
                <th className="w-[110px] py-3 font-medium">권한</th>
                <th className="w-[100px] py-3 font-medium">상태</th>
                <th className="w-[80px] py-3 font-medium">녹화</th>
                <th className="w-[260px] py-3 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {others.map((u) => {
                const [label, color] = STATUS[u.status];
                const me = u.id === viewer.id;
                return (
                  <tr key={u.id} className="border-b border-line">
                    <td className="py-4">
                      <p className="text-[15px] text-ink">
                        {u.name}
                        {me && <span className="ml-2 text-[12.5px] text-ter">나</span>}
                      </p>
                      <p className="mt-0.5 text-[13px] text-sub">{u.email}</p>
                    </td>
                    <td className="py-4 text-[13.5px] text-body">{u.role === "admin" ? "운영진" : "강사"}</td>
                    <td className={`py-4 text-[13.5px] ${color}`}>{label}</td>
                    <td className="tnum py-4 text-[13.5px] text-body">{counts.get(u.id) ?? 0}개</td>
                    <td className="py-4">
                      {!me && (
                        <div className="flex justify-end gap-2">
                          {u.status === "active" &&
                            (u.role === "admin" ? (
                              <ActionButton id={u.id} action="remove_admin" label="운영진 해제" />
                            ) : (
                              <ActionButton id={u.id} action="make_admin" label="운영진 지정" />
                            ))}
                          {u.status === "active" ? (
                            <ActionButton id={u.id} action="disable" label="정지" tone="danger" />
                          ) : (
                            <ActionButton id={u.id} action="enable" label="다시 사용" />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
