Current 54 — Cell ID Registry Identity Priority

Changes from Current 53:
- LTE Cell ID math now derives eNB/sector first and searches the full local registry by radio + eNB.
- A unique registry match overrides OCR/hotspot operator carrier and inferred PLMN.
- PLMN/operator is used only as a tie-breaker if the same numeric tower ID exists for multiple carriers.
- 5G NCI registry matching now tests all mapped gNBs before using carrier/PLMN as a tie-breaker.
- Franklin parser, M2000/generic scanner, offline OCR, local registry, offline edits and automatic cloud sync are preserved.
