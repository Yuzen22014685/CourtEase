// CourtEase app icon (the shuttlecock from the CourtEase logo).
// Used in the headers, auth pages, empty states and the 404 page.
// Decorative by default (empty alt); pass `title` when it is the only content.
export default function LogoMark({ className = 'h-8 w-8', title }) {
  return (
    <img
      src="/logo-icon.png"
      alt={title || ''}
      aria-hidden={title ? undefined : true}
      draggable="false"
      className={`object-contain select-none shrink-0 ${className}`}
    />
  )
}
