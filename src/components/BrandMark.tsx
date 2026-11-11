/** The site mark: a ring (the "observatoire") with a rising poll curve and an orange latest-reading dot. */
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 15.5 9 11.8l3 2.4 5.5-5.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="8.5" r="2.1" fill="var(--orange)" />
    </svg>
  );
}
