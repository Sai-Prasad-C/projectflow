interface BrandProps {
  size?: number
  showName?: boolean
  className?: string
}

export default function Brand({ size = 24, showName = true, className }: BrandProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.33 + 'px' }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size * (46 / 48)}
        viewBox="0 0 48 46"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="#863bff"
          d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
        />
      </svg>
      {showName && (
        <span style={{ fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1 }}>
          ProjectFlow
        </span>
      )}
    </span>
  )
}
