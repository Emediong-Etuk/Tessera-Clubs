import { NavLink } from "./NavLink";
import { buttonClass } from "@/lib/ui";

export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <NavLink href={href} className={buttonClass("ghost", "sm", "mb-2 -ml-3 px-3")}>
      &larr; {label}
    </NavLink>
  );
}
