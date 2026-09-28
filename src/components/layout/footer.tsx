import { Link } from "react-router"
import { siGithub } from "simple-icons"
import { ModeToggle } from "@/components/mode-toggle"

export function Footer() {
  return (
    <footer className="w-full border-t p-2">
      <div className="flex  gap-2">
        <Link
          to="https://github.com/karppa404"
          aria-label="GitHub"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5 fill-current"
          >
            <path d={siGithub.path} />
          </svg>
        </Link>

        <ModeToggle />
      </div>
    </footer>
  )
}
