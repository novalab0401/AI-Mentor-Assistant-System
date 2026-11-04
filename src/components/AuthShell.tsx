// 로그인·가입 화면 틀. 사이드바 위를 덮어 로그인 전에는 메뉴가 보이지 않게 한다.
export function AuthShell({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white px-4">
      <div className="mx-auto flex min-h-full w-full max-w-[340px] flex-col justify-center py-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nova-lab-mark.svg" alt="" className="size-10" />
        <h1 className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        <p className="mt-2 text-[14px] text-sub">{desc}</p>
        {children}
      </div>
    </div>
  );
}

export function Field(props: { id: string; label: string; type?: string; autoComplete?: string; defaultValue?: string; hint?: string; minLength?: number; autoFocus?: boolean }) {
  return (
    <div className="mt-5">
      <label htmlFor={props.id} className="block text-[13px] font-medium text-ink">
        {props.label}
      </label>
      <input
        id={props.id}
        name={props.id}
        type={props.type ?? "text"}
        required
        minLength={props.minLength}
        autoFocus={props.autoFocus}
        autoComplete={props.autoComplete}
        defaultValue={props.defaultValue}
        aria-describedby={props.hint ? `${props.id}-hint` : undefined}
        className="mt-2 h-11 w-full rounded-xl border border-line px-3.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
      />
      {props.hint && (
        <p id={`${props.id}-hint`} className="mt-1.5 text-[12.5px] text-ter">
          {props.hint}
        </p>
      )}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "alert" | "info"; children: React.ReactNode }) {
  return (
    <p role={tone === "alert" ? "alert" : "status"} className={`mt-6 rounded-xl px-3.5 py-3 text-[13.5px] leading-relaxed ${tone === "alert" ? "border border-alert/30 text-alert" : "bg-tint text-ink"}`}>
      {children}
    </p>
  );
}
