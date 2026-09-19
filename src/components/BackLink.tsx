import { NavLink } from "./NavLink";

export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <NavLink
      href={href}
      className="mb-2 inline-flex text-sm text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
    >
      &larr; {label}
    </NavLink>
  );
}
