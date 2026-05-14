import type { ComponentProps } from "react"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

type LoaderProps = Omit<ComponentProps<typeof Loader2Icon>, "children" | "ref">

function Spinner({ className, ...props }: LoaderProps) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
