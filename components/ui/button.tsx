import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-[rgba(6,78,59,0.5)] focus-visible:ring-[3px] aria-invalid:ring-[rgba(239,68,68,0.2)] dark:aria-invalid:ring-[rgba(239,68,68,0.4)] aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-[rgba(6,78,59,0.9)]',
        destructive:
          'bg-destructive text-white hover:bg-[rgba(239,68,68,0.9)] focus-visible:ring-[rgba(239,68,68,0.2)] dark:focus-visible:ring-[rgba(239,68,68,0.4)] dark:bg-[rgba(239,68,68,0.6)]',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-[rgba(231,229,227,0.3)] dark:border-input dark:hover:bg-[rgba(231,229,227,0.5)]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[rgba(245,245,244,0.8)]',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-[rgba(34,197,94,0.5)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-11 h-11 px-4 py-2 has-[>svg]:px-3',
        sm: 'min-h-10 h-10 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'min-h-12 h-12 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-11 min-h-11 min-w-11',
        'icon-sm': 'size-11 min-h-11 min-w-11',
        'icon-lg': 'size-12 min-h-12 min-w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
