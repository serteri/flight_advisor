import * as React from "react"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      type="checkbox"
      className={cn(
        "peer h-5 w-9 cursor-pointer appearance-none rounded-full bg-gray-200 transition-colors checked:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 relative after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-all checked:after:translate-x-4 hover:after:scale-110",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Switch.displayName = "Switch"

export { Switch }
