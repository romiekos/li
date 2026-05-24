interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 24, className }: LogoProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 63 63"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M48 16V24H40V16H48ZM48 32V40H56V48H40V40H32V32H48Z" fill="currentColor" />
      <path d="M16 16V40H32V48H8V16H16Z" fill="currentColor" />
    </svg>
  );
}
