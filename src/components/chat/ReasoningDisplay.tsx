import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ReasoningDisplayProps {
  reasoning: string;
  stepNumber?: number;
}

export function ReasoningDisplay({ reasoning, stepNumber }: ReasoningDisplayProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {stepNumber ? `Step ${stepNumber} Reasoning` : 'Reasoning'}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pt-2">
        <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3 prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{reasoning}</ReactMarkdown>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
