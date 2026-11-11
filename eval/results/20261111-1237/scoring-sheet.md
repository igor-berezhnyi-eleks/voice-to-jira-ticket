# Scoring sheet

Fill in the empty fields for every ticket (plan 7.3). Invention: `none`, `minor` or `critical` (critical = changes the meaning or adds a wrong concrete detail). Usability: `usable`, `minor edit` or `rewrite`.
A trap hit that is only inside a missing-information question may merely mention the term: judge it, do not count it automatically.

## claude-haiku-5-5

Provider `Claude` · scenarios `eval-scenarios-v1` (hash `45492e444349`) · prompt hash `31c6b80c09d1` · commit `d15676f` (uncommitted changes) · started 2026-11-11 12:37 +02:00

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

**Bug: CSV export contains only the header row when the invoice list is filtered by Overdue status**

When the invoice list is filtered by status Overdue, which shows twelve invoices, clicking Export CSV downloads a file containing only the header row. Exporting without the filter works fine.

- Steps to reproduce: Open the invoice list | Filter by status Overdue, which shows twelve invoices | Click Export CSV
- Actual result: The file downloads but contains only the header row, with no invoices.
- Expected result: A file containing the twelve overdue invoices.
- Environment: Ledgerly version 3.8.2, Chrome 126, Windows 11

Missing information: none

Type check: match · latency 3493 ms · tokens 2428 in / 496 out

- Facts present: __ of 5
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 
