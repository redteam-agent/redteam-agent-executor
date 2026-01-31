import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface ReasoningDisplayProps {
  stepNumber: number
  reasoning: string
}

export function ReasoningDisplay({ stepNumber, reasoning }: ReasoningDisplayProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        {open ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        Step {stepNumber} Reasoning
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pt-2 text-sm">
        <div className="p-3 rounded-md bg-muted/50 prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{reasoning}</ReactMarkdown>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
