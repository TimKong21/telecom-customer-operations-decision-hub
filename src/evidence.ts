import { emptyState, type ReportId, type ReportState } from "./types";

type Finding = {
  id: string;
  report: ReportId;
  page: number;
  target: string;
  preset: ReportState;
  scope: string;
  title: string;
  finding: string;
  nextStep: string;
};

// Published IDs are used in report citations.
export const findings: readonly Finding[] = [
  {
    id: "call-volume-peak",
    report: "calls",
    page: 1,
    target: "hourly",
    preset: emptyState(),
    scope: "All 5,000 calls",
    title: "Review staffing coverage around noon",
    finding:
      "The 13:00 hour had the most calls (594). The 12:00 hour had the most unanswered calls (116 vs. 110 at 13:00) and a higher unanswered rate (21.2% vs. 18.5%).",
    nextStep:
      "Check whether the noon pattern holds across dates and topics before changing shift coverage.",
  },
  {
    id: "churn-by-contract",
    report: "retention",
    page: 2,
    target: "internet-risk",
    preset: { ...emptyState(), filters: { contract: ["Month-to-month"] } },
    scope: "3,875 month-to-month customers",
    title: "Start retention pilot planning with month-to-month fibre customers",
    finding:
      "Within month-to-month contracts, fibre customers churned at 54.6% (1,162 of 2,128), compared with 32.2% for DSL and 18.9% for customers without internet service.",
    nextStep:
      "Use this segment to define a pilot audience and test which outreach improves retention.",
  },
  {
    id: "fy20-leadership-representation",
    report: "inclusion",
    page: 1,
    target: "hiring",
    preset: emptyState(),
    scope: "FY20 workforce",
    title: "Review the path to senior roles",
    finding:
      "In FY20, women held 109 of 204 junior officer roles, 10 of 56 senior manager roles, and 2 of 16 executive roles.",
    nextStep:
      "Review promotion eligibility and outcomes by level to investigate where the representation gap emerges.",
  },
];

export function findEvidence(
  report: ReportId,
  page: number,
  id?: string | null,
) {
  return findings.find(
    (finding) =>
      finding.id === id && finding.report === report && finding.page === page,
  );
}
