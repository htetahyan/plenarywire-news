-- Retire tip-only; NC/ND outlets become facts-only (extract → corroborate → write from primary).
UPDATE sources SET mode='facts-only',
  licence_note='CC BY-NC-ND: facts-only pipeline — extract bare facts, corroborate with a primary/official source, write original text; never adapt ProPublica wording. Tip pages removed 2026-11-09.'
  WHERE id='propublica';
UPDATE sources SET mode='facts-only',
  licence_note='CC BY-ND 4.0: facts-only pipeline — no derivatives of Conversation text; corroborate + original writing from primary. Tip pages removed 2026-11-09.'
  WHERE id='conversation';
UPDATE sources SET mode='facts-only',
  licence_note='CC BY 3.0: facts-only pipeline (adaptation allowed with credit, but we still corroborate and write from primary). Images need separate rights.'
  WHERE id='globalvoices';
UPDATE sources SET mode='facts-only',
  licence_note='CC BY-NC-ND: facts-only pipeline — never adapt Democracy Now! wording; corroborate + write from primary.'
  WHERE id='democracynow';
