# Scanner benchmark workflow

Scanner diagnostics stores each operator-confirmed decision as a bounded local benchmark record. The record contains the expected card (the operator's choice), the scanner's original top prediction and top-five candidate IDs, confidence, and stage timings. No card photographs are stored.

1. Enable **Diagnostics** in the admin scanner.
2. Scan a labelled mix of cards and select the correct candidate whenever confirmation is shown.
3. Use **Export benchmark data** in the diagnostics controls.
4. Run:

   ```bash
   npm run benchmark:scanner -- --input ./ancient-pulls-scanner-benchmark-YYYY-MM-DD.json
   ```

The report includes correct, incorrect, unresolved and top-three rates plus average/p95 latency, capture cost and OCR latency. Add tags to exported records (for example `holo`, `sleeved`, `glare`, `low-light`, `rotation`, `full-art`) before aggregation to compare conditions. Do not claim an accuracy target until a representative labelled dataset has been recorded.
