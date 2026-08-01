import {
  BookingDisplay,
  type BookingResult,
} from '@/components/chat/widgets/BookingDisplay';
import {
  CadDrawingDisplay,
  type CadDrawingResult,
} from '@/components/chat/widgets/CadDrawingDisplay';
import { GenericToolDisplay } from '@/components/chat/widgets/GenericToolDisplay';
import {
  KnowledgeBaseDisplay,
  type KnowledgeBaseResult,
} from '@/components/chat/widgets/KnowledgeBaseDisplay';
import {
  LeadFormCard,
  type LeadFormResult,
} from '@/components/chat/widgets/LeadFormCard';
import {
  QuotationDisplay,
  type QuotationResult,
} from '@/components/chat/widgets/QuotationDisplay';
import { RoiDisplay, type RoiResult } from '@/components/chat/widgets/RoiDisplay';
import {
  SubsidyDisplay,
  type SubsidyResult,
} from '@/components/chat/widgets/SubsidyDisplay';
import {
  SystemSizeDisplay,
  type SystemSizeResult,
} from '@/components/chat/widgets/SystemSizeDisplay';

export interface ToolResultDisplayProps {
  name: string;
  result: unknown;
}

/**
 * Tools that run for the model's benefit, not the customer's.
 * `collect_customer_info` only echoes the profile updates that were already
 * applied through the `context` event, and `scrape_website` arrives with a null
 * result by design — the backend strips the page text before sending it.
 */
const SILENT_TOOLS = new Set(['collect_customer_info', 'scrape_website']);

/**
 * Picks the widget for a tool result.
 *
 * Payloads are typed per widget but arrive as `unknown`, so each branch casts.
 * That is the honest shape of the boundary: nothing validates these on the way
 * in, and the widgets are written to render an em dash rather than trust a
 * field to be there.
 */
export function ToolResultDisplay({ name, result }: ToolResultDisplayProps) {
  if (SILENT_TOOLS.has(name)) return null;
  if (result === null || result === undefined) return null;

  switch (name) {
    case 'generate_quotation':
      return <QuotationDisplay result={result as QuotationResult} />;
    case 'calculate_roi':
      return <RoiDisplay result={result as RoiResult} />;
    case 'book_site_visit':
      return <BookingDisplay result={result as BookingResult} type="site_visit" />;
    case 'offer_lead_form':
      return <LeadFormCard result={result as LeadFormResult} />;
    case 'calculate_system_size':
      return <SystemSizeDisplay result={result as SystemSizeResult} />;
    case 'check_subsidies':
      return <SubsidyDisplay result={result as SubsidyResult} />;
    case 'generate_cad_drawing':
      return <CadDrawingDisplay result={result as CadDrawingResult} />;
    case 'search_knowledge_base':
      return <KnowledgeBaseDisplay result={result as KnowledgeBaseResult} />;
    default:
      return <GenericToolDisplay name={name} result={result} />;
  }
}
