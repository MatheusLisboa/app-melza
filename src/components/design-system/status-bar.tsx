/** StatusBar — chrome mock iOS (protótipo) */
export function StatusBar() {
  return (
    <div className="relative flex h-11 shrink-0 items-center justify-between px-6">
      <span className="font-mono text-[13px] font-semibold text-[#111111]">
        9:41
      </span>
      <div className="absolute left-1/2 h-7 w-[110px] -translate-x-1/2 rounded-b-[18px] bg-[#111111]" />
      <div className="flex items-center gap-1.5 text-[#111111]">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none" aria-hidden>
          <rect x="0" y="3" width="3" height="9" rx="1" fill="currentColor" opacity="0.35" />
          <rect x="4.5" y="2" width="3" height="10" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="9" y="0.5" width="3" height="11.5" rx="1" fill="currentColor" />
          <rect x="13.5" y="0.5" width="3" height="11.5" rx="1" fill="currentColor" />
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden>
          <path
            d="M8 2.5a7 7 0 0 1 5 2.1M3 4.6A7 7 0 0 1 8 2.5M5.5 7a3.5 3.5 0 0 1 5 0M8 9.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <div className="flex items-center gap-0.5">
          <div className="relative h-[11px] w-[22px] rounded-[3px] border border-[#111111]/60 p-[2px]">
            <div className="h-full w-[13px] rounded-[1.5px] bg-[#111111]" />
          </div>
        </div>
      </div>
    </div>
  );
}
