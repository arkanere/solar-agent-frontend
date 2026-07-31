import { Badge } from '@/components/ui/badge';
import { humanizeToolName } from '@/lib/format';
import type { MessageIntent } from '@/lib/types';

/**
 * What the classifier decided the customer was asking for, in words a customer
 * would use. The keys are the backend's `UserIntent` enum verbatim — a value
 * missing here falls through to a title-cased version of the raw name, which
 * reads acceptably but means the enum has grown.
 */
const INTENT_LABELS: Record<string, string> = {
  // Awareness
  general_inquiry: 'General question',
  how_solar_works: 'How solar works',
  benefits_inquiry: 'Benefits of solar',
  // Consideration
  pricing_inquiry: 'Pricing',
  system_sizing: 'System sizing',
  roi_calculation: 'Savings and payback',
  subsidy_inquiry: 'Subsidies',
  technical_question: 'Technical question',
  comparison_request: 'Comparing options',
  // Decision
  request_quotation: 'Quotation request',
  book_site_visit: 'Site visit',
  financing_inquiry: 'Financing',
  eligibility_check: 'Eligibility',
  installer_inquiry: 'Installers',
  // Installation
  request_cad_drawing: 'Layout drawing',
  installation_timeline: 'Installation timeline',
  document_request: 'Documents',
  // Support
  maintenance_inquiry: 'Maintenance',
  troubleshooting: 'Troubleshooting',
  contact_request: 'Contact request',
  other: 'Other',
};

/** The backend's `JourneyStage` enum, phrased as where the customer has got to. */
const STAGE_LABELS: Record<string, string> = {
  awareness: 'Learning',
  consideration: 'Comparing',
  decision: 'Deciding',
  installation: 'Installing',
  support: 'Support',
};

/**
 * Below this the classifier is guessing, and showing a number next to a guess
 * reads as precision the answer does not have. The label itself still shows —
 * it is only the confidence figure that is withheld.
 */
const CONFIDENCE_THRESHOLD = 0.8;

export interface IntentBadgeProps {
  intent: MessageIntent;
}

export function IntentBadge({ intent }: IntentBadgeProps) {
  const label = INTENT_LABELS[intent.intent] ?? humanizeToolName(intent.intent);
  const stage = STAGE_LABELS[intent.journeyStage];

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant="secondary" className="h-4 px-1.5 text-[0.65rem] font-normal">
        {label}
      </Badge>

      {stage && (
        <Badge variant="outline" className="h-4 px-1.5 text-[0.65rem] font-normal">
          {stage}
        </Badge>
      )}

      {intent.confidence > CONFIDENCE_THRESHOLD && (
        <span className="text-[0.65rem] text-muted-foreground">
          {Math.round(intent.confidence * 100)}% confident
        </span>
      )}
    </div>
  );
}
