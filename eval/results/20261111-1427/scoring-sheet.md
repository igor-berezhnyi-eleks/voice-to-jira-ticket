# Scoring sheet

Fill in the empty fields for every ticket (plan 7.3). Invention: `none`, `minor` or `critical` (critical = changes the meaning or adds a wrong concrete detail). Usability: `usable`, `minor edit` or `rewrite`.
A trap hit that is only inside a missing-information question may merely mention the term: judge it, do not count it automatically.
Audio path: transcripts from `Systran/faster-whisper-medium.en` (language `en`). Pooled word error rate against the scripts: 2,8%. Tickets made from the transcripts are in the blocks "from audio" below; score them like the others.

## claude-haiku-5-5

Provider `Claude` · scenarios `eval-scenarios-v1` (hash `45492e444349`) · prompt hash `31c6b80c09d1` · commit `b02209c` (uncommitted changes) · started 2026-11-11 14:27 +02:00

Valid on the first attempt: 1 of 1 · valid after the retry: 1 of 1 (the Go thresholds use the first number).

### BUG-01 (expected Bug)

> Hi, I found a bug in the CSV export. I'm on Ledgerly version 3.8.2, using Chrome 126 on Windows 11. I open the invoice list, filter by status Overdue, which shows twelve invoices, and then click Export CSV. The file downloads, but it only contains the header row, no invoices at all. What I expect is a file with those twelve overdue invoices. If I export without the filter, it works fine.

Facts that must appear:
- Export CSV produces a file containing only the header row
- Steps: open the invoice list, filter by status Overdue (12 invoices shown), click Export CSV
- Expected: the file contains the 12 overdue invoices
- Exporting without the filter works
- Environment: Ledgerly 3.8.2, Chrome 126, Windows 11

Missing information expected: none
Traps: `Firefox` (Only Chrome was mentioned); `macOS` (The OS is Windows 11); `timeout` (No cause was suggested); `500` (No server error was mentioned)

#### BUG-01 · run 1

**Bug: CSV export with Overdue status filter contains only the header row**

When the invoice list is filtered by status Overdue, Export CSV downloads a file that contains only the header row and no invoices. Exporting without the filter works correctly.

- Steps to reproduce: Open the invoice list | Filter by status Overdue, which shows twelve invoices | Click Export CSV
- Actual result: The file downloads but contains only the header row and no invoices.
- Expected result: A file containing the twelve overdue invoices.
- Environment: Ledgerly 3.8.2, Chrome 126, Windows 11

Missing information: none

Type check: match · latency 3622 ms · tokens 2428 in / 637 out

- Facts present: __ of 5
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### BUG-01 · from audio

STT transcript (8129 ms):

> Hi, I found a bug in the CSV export. I'm on ledgerly version 3.8.2 using Chrome 126 on Windows 11. I open the invoice list, filter by status overdue, which shows 12 invoices, and then click Export CSV. The file downloads, but it only contains the header row. No invoices at all. What I expect is a file with those 12 overdue invoices. If I export without the filter, it works fine.

Word error rate: 2,8% (2 substituted, 0 missing, 0 extra, of 72 words in the script)
Script path type (run 1): Bug

**Bug: CSV export contains only header row when invoice list is filtered by status overdue**

When the invoice list is filtered by status overdue (12 invoices shown), clicking Export CSV downloads a file that contains only the header row and no invoices. Exporting without the filter works fine.

- Steps to reproduce: Open the invoice list | Filter by status overdue, which shows 12 invoices | Click Export CSV
- Actual result: The CSV file downloads but contains only the header row with no invoices.
- Expected result: A CSV file containing the 12 overdue invoices.
- Environment: ledgerly version 3.8.2, Chrome 126, Windows 11

Missing information: none

Type check: match · latency 1677 ms · tokens 2426 in / 257 out

- Facts present: __ of 5
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 
