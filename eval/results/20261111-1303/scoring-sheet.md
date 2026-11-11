# Scoring sheet

Fill in the empty fields for every ticket (plan 7.3). Invention: `none`, `minor` or `critical` (critical = changes the meaning or adds a wrong concrete detail). Usability: `usable`, `minor edit` or `rewrite`.
A trap hit that is only inside a missing-information question may merely mention the term: judge it, do not count it automatically.

## claude-haiku-5-5

Provider `Claude` · scenarios `eval-scenarios-v1` (hash `45492e444349`) · prompt hash `31c6b80c09d1` · commit `a03fc41` (uncommitted changes) · started 2026-11-11 13:03 +02:00

Valid on the first attempt: 19 of 19 · valid after the retry: 19 of 19 (the Go thresholds use the first number).

### AMBIGUOUS-01 (expected Bug)

> When I change a customer's currency from euro to dollars, their old invoices still show euros. I'm not sure if that's wrong or if it's meant to work like that, because maybe finance wants old invoices to stay as they were. But somebody should probably look at it.

Facts that must appear:
- Changing a customer's currency from euro to dollars leaves their old invoices showing euros
- The reporter is unsure whether this is wrong or intended
- Finance may want old invoices to stay unchanged

Missing information expected: general: is this a defect or a requested change in behaviour?
Traps: `exchange rate` (No conversion was mentioned); `tax` (Tax was not mentioned); `rounding` (Not mentioned); `Chrome` (No browser was mentioned)

#### AMBIGUOUS-01 · run 1

**Bug: Old invoices still show euros after changing a customer's currency from euro to dollars**

When a customer's currency is changed from euro to dollars, their existing invoices still show euros. The reporter is not sure whether this is wrong or intended, since finance may want old invoices to stay as they were.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: Old invoices still show euros after the customer's currency is changed to dollars.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this wrong behaviour, or is keeping old invoices in euros intended so that finance keeps them unchanged? If intended, should this be a Feature instead?; [bug.expectedResult] What should the old invoices show after the customer's currency is changed to dollars?; [bug.environment] Which system, version or environment was this seen in?; [bug.stepsToReproduce] Which screen or action was used to view the old invoices, and were they opened before or after the currency change?

Type check: not counted · latency 6647 ms · tokens 2369 in / 1161 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 2

**Bug: Old invoices still show euros after customer currency is changed to dollars**

After a customer's currency is changed from euro to dollars, their existing invoices still display euros. The reporter is unsure whether this is wrong or intended, since finance may want old invoices to remain unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars
- Actual result: Old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should the old invoices show after the currency change?; [bug.environment] In which environment or application version does this happen?; [general] Is this a bug or intended behaviour that should be kept, for example so finance can keep old invoices as they were? If it is a change request, it should be filed as a Feature.

Type check: not counted · latency 3861 ms · tokens 2369 in / 735 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 3

**Bug: Old invoices still show euros after a customer's currency is changed to dollars**

After a customer's currency is changed from euro to dollars, their old invoices still show euros. The reporter is unsure whether this is wrong or intended, since finance may want old invoices to stay as they were.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: Old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should the old invoices show after the customer's currency changes from euro to dollars?; [bug.environment] Which system, version or environment was this seen in?; [general] Is this a bug, or is keeping old invoices in their original currency intended behaviour that finance wants?

Type check: not counted · latency 3958 ms · tokens 2369 in / 783 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 4

**Bug: Old invoices still show euros after a customer's currency is changed to dollars**

When a customer's currency is changed from euro to dollars, their existing invoices still show euros. The reporter is unsure whether this is wrong or intended, since finance may want old invoices to stay as they were.

- Steps to reproduce: Change a customer's currency from euro to dollars | Open one of the customer's existing invoices
- Actual result: The old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should the old invoices show after the currency change?; [bug.environment] Which system, version or environment was this seen in?; [general] Is this a bug or intended behaviour, since finance may want old invoices to keep their original currency? If it is a feature request, should old invoices keep their currency or update to dollars?

Type check: not counted · latency 3404 ms · tokens 2369 in / 668 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

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

**Bug: CSV export contains only header row when invoice list is filtered by status Overdue**

When the invoice list is filtered by status Overdue, which shows twelve invoices, clicking Export CSV downloads a file containing only the header row and no invoices. Exporting without the filter works correctly.

- Steps to reproduce: Open the invoice list | Filter by status Overdue, which shows twelve invoices | Click Export CSV
- Actual result: The file downloads but contains only the header row, with no invoices.
- Expected result: A file with the twelve overdue invoices is downloaded.
- Environment: Ledgerly version 3.8.2, Chrome 126, Windows 11

Missing information: [bug.stepsToReproduce] Does the problem happen with any other status filter, or only with Overdue?

Type check: match · latency 1733 ms · tokens 2428 in / 306 out

- Facts present: __ of 5
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

### BUG-02 (expected Bug)

> There's a problem when saving invoices. If I open an existing invoice, clear the due date field and press Save, the whole editor just closes and all my unsaved changes are gone. It happens every time I try it.

Facts that must appear:
- Steps: open an existing invoice, clear the due date field, press Save
- Actual: the editor closes and unsaved changes are lost
- It happens every time

Missing information expected: bug.expectedResult; bug.environment
Traps: `Chrome` (No browser was mentioned); `Safari` (No browser was mentioned); `validation error` (The expected behaviour was not stated); `console` (No console output was mentioned)

#### BUG-02 · run 1

**Bug: Editor closes and unsaved changes are lost when saving an invoice with the due date cleared**

When an existing invoice is opened, the due date field is cleared and Save is pressed, the whole editor closes and all unsaved changes are lost. The speaker says this happens every time.

- Steps to reproduce: Open an existing invoice | Clear the due date field | Press Save
- Actual result: The whole editor closes and all unsaved changes are lost. It happens every time.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should happen when you press Save with the due date cleared: should the invoice save, or should a validation message appear?; [bug.environment] Which browser, operating system, and application version were you using?; [bug.stepsToReproduce] Are there any other steps between opening the invoice and pressing Save, or any other fields you changed?

Type check: match · latency 2338 ms · tokens 2352 in / 350 out

- Facts present: __ of 3
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

### BUG-03 (expected Bug)

> The revenue chart on the dashboard is broken. It just shows nothing.

Facts that must appear:
- The revenue chart on the dashboard shows nothing

Missing information expected: bug.stepsToReproduce; bug.expectedResult; bug.environment
Traps: `Chrome` (No browser was mentioned); `empty` (The speaker said 'nothing'; whether the chart is blank, empty or erroring is unknown); `last month` (No time range was mentioned); `spinner` (No loading state was mentioned)

#### BUG-03 · run 1

**Bug: Revenue chart on dashboard shows nothing**

The revenue chart on the dashboard displays no data. The reporter says it shows nothing.

- Steps to reproduce: none
- Actual result: The revenue chart on the dashboard shows nothing.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.stepsToReproduce] What steps lead to the revenue chart showing nothing?; [bug.expectedResult] What should the revenue chart show instead?; [bug.environment] Which browser, operating system, or environment were you using when this happened?

Type check: match · latency 1427 ms · tokens 2313 in / 251 out

- Facts present: __ of 1
- Expected missing flagged: __ of 3 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

### BUG-04 (expected Bug)

> Some of our customers are getting the payment reminder email twice. Not all of them, just some, and I can't see a pattern. The reminder should go out once, three days before the due date. This is on the production system, and it started after the update last week.

Facts that must appear:
- Some customers receive the payment reminder email twice
- Only some customers are affected, no pattern known
- Expected: the reminder is sent once, three days before the due date
- Production system
- Started after last week's update

Missing information expected: bug.stepsToReproduce
Traps: `Gmail` (No email provider was mentioned); `scheduler` (No cause was suggested); `timezone` (No cause was suggested); `duplicate invoice` (No such cause was mentioned)

#### BUG-04 · run 1

**Bug: Some customers receive the payment reminder email twice**

Some customers are receiving the payment reminder email twice instead of once. The reminder should be sent once, three days before the due date. The problem occurs on production and started after last week's update.

- Steps to reproduce: Wait for the payment reminder to be sent to some customers
- Actual result: Some customers receive the payment reminder email twice. The reporter cannot see a pattern for which customers are affected.
- Expected result: The payment reminder is sent once, three days before the due date.
- Environment: Production system. Started after the update last week.

Missing information: [bug.stepsToReproduce] What exact steps lead to a customer receiving the duplicate reminder, for example which trigger or action sends it?; [bug.environment] What exact update was deployed last week, and which version or release is production running now?; [bug.actualResult] How many customers are affected, and do the two emails arrive at the same time or at different times?

Type check: match · latency 2992 ms · tokens 2359 in / 365 out

- Facts present: __ of 5
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

### FEATURE-01 (expected Feature)

> I'd like to request a bulk action for marking invoices as paid. Right now our accountants mark them one by one after every bank import, and it takes ages. Here's what I'd want. In the invoice list there are checkboxes, so you can select several invoices. As soon as at least one is selected, a button called Mark as paid appears. Clicking it opens a confirmation dialog that shows how many invoices will be changed. The paid date is set to today by default. And invoices that are already paid are skipped, not changed.

Facts that must appear:
- Need: accountants mark invoices as paid one by one after each bank import, which is slow
- Invoice list gets checkboxes for selecting several invoices
- A Mark as paid button appears once at least one invoice is selected
- Clicking it opens a confirmation dialog showing the number of invoices that will be changed
- Paid date defaults to today
- Already paid invoices are skipped

Missing information expected: none
Traps: `undo` (Undo was not requested); `audit` (Audit logging was not requested); `permission` (Roles or permissions were not mentioned); `email` (No notification was mentioned)

#### FEATURE-01 · run 1

**Feature: Bulk action to mark selected invoices as paid**

Accountants currently mark invoices as paid one by one after each bank import, which is slow. The invoice list should let users select several invoices with checkboxes and mark them all as paid at once, with a confirmation dialog, a default paid date of today, and already paid invoices left unchanged.

- User need: Accountants need to mark invoices as paid in bulk after each bank import, because marking them one by one takes too long.
- Proposed behavior: In the invoice list, each invoice has a checkbox so several can be selected. When at least one invoice is selected, a Mark as paid button appears. Clicking it opens a confirmation dialog that shows how many invoices will be changed. The paid date defaults to today. Invoices that are already paid are skipped and not changed.
- Acceptance criteria: The invoice list shows a checkbox for each invoice that lets the user select it. | The user can select several invoices at once. | The Mark as paid button appears when at least one invoice is selected. | Clicking Mark as paid opens a confirmation dialog that shows the number of invoices that will be changed. | The paid date is set to today by default. | Invoices that are already paid are skipped and are not changed.

Missing information: [feature.proposedBehavior] Can the user change the paid date in the confirmation dialog, or is it always today?

Type check: match · latency 4922 ms · tokens 2448 in / 904 out

- Facts present: __ of 6
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

### FEATURE-02 (expected Feature)

> Feature idea: a dark mode for Ledgerly. A lot of us work late in the evening and the white screen is hard on the eyes. I think there should be a switch in the user menu to turn dark mode on and off, and the app should remember my choice the next time I log in.

Facts that must appear:
- Need: users working in the evening find the white screen hard on the eyes
- A dark mode option for the app
- A switch in the user menu turns dark mode on and off
- The choice is remembered at the next login

Missing information expected: none
Traps: `system theme` (Following the operating system setting was not mentioned); `high contrast` (Accessibility modes were not mentioned); `mobile` (No mobile app was mentioned); `settings page` (The switch is in the user menu, not a settings page)

#### FEATURE-02 · run 1

**Feature: Add dark mode toggle to the user menu with saved preference**

Users who work late find the white screen hard on the eyes. Add a switch in the user menu to turn dark mode on and off, and have the app remember the choice at the next login.

- User need: Users who work late in the evening find the white screen hard on the eyes and want a darker display.
- Proposed behavior: Add a switch in the user menu to turn dark mode on and off. The app remembers the user's choice the next time they log in.
- Acceptance criteria: A switch in the user menu turns dark mode on and off. | The dark mode setting is still applied after the user logs out and logs in again.

Missing information: [feature.acceptanceCriteria] Should the dark mode setting apply to every screen in Ledgerly, or only to some of them?; [feature.proposedBehavior] Should the app use the operating system's dark mode setting as the default for new users?; [title] Is 'Ledgerly' the correct product name?

Type check: match · latency 2259 ms · tokens 2373 in / 376 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

### FEATURE-03 (expected Feature)

> So, our customers keep asking whether we could make the invoices more customizable. They want them to feel more like their own brand, you know. I'm not sure exactly what that should look like, but it would be good to look into it.

Facts that must appear:
- Customers ask for more customizable invoices
- They want invoices to feel like their own brand
- The exact solution is not known yet

Missing information expected: feature.proposedBehavior; feature.acceptanceCriteria
Traps: `PDF` (The output format was not mentioned); `color picker` (No specific control was proposed); `font` (No specific customization was proposed); `watermark` (No specific customization was proposed)

#### FEATURE-03 · run 1

**Feature: Allow customers to customize invoice branding**

Customers have asked for more customizable invoices so they feel more like their own brand. The speaker is unsure what the customization should look like and wants it investigated.

- User need: Customers want invoices that feel more like their own brand.
- Proposed behavior: Not provided
- Acceptance criteria: none

Missing information: [feature.proposedBehavior] What specific invoice elements should be customizable, such as logo, colours, fonts or layout?; [feature.acceptanceCriteria] What would show the feature works, for example a customer can upload a logo that appears on generated invoices?; [feature.userNeed] Which customers or customer segments are asking for this, and is there a specific business reason beyond brand feel?

Type check: match · latency 2583 ms · tokens 2353 in / 304 out
- **Trap hit:** `font` in missingInformation (only in questions)

- Facts present: __ of 3
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

### MIXED-01 (expected Bug)

> Two things about the invoice PDF. First, there's a bug: when an invoice has more than twenty line items, the last line item is cut off in the PDF. I made one with twenty-five items, downloaded the PDF, and the twenty-fifth item was missing. All items should be in there, of course. Second, and this is more of a wish, it would be nice to have a custom footer note on invoices, like a thank-you message or bank details.

Facts that must appear:
- Bug: with more than 20 line items, the last item is cut off in the invoice PDF
- Steps: create an invoice with 25 line items, download the PDF; the 25th item is missing
- Expected: all line items appear in the PDF
- Separate request: a custom footer note on invoices, such as a thank-you message or bank details

Missing information expected: general: the footer note request is a separate feature and should be its own ticket; bug.environment
Traps: `page break` (No cause was suggested); `second page` (Pagination was not mentioned); `Chrome` (No browser was mentioned); `logo` (Only a footer note was requested)

#### MIXED-01 · run 1

**Bug: Invoice PDF cuts off the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The speaker created an invoice with twenty-five items, and the twenty-fifth item did not appear in the PDF. All items should appear in the PDF.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF
- Actual result: The last line item (the twenty-fifth) is missing from the PDF.
- Expected result: All line items appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate feature ticket for it?

Type check: not counted · latency 4430 ms · tokens 2423 in / 700 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 2

**Bug: Invoice PDF cuts off the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The reporter made an invoice with twenty-five items and the twenty-fifth was absent, though all items should appear.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF
- Actual result: The last line item (the twenty-fifth) is missing from the PDF.
- Expected result: All line items should appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when the PDF was downloaded?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate feature ticket for it?

Type check: not counted · latency 4211 ms · tokens 2423 in / 677 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 3

**Bug: Invoice PDF cuts off the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the PDF is missing the last item. The reporter made an invoice with twenty-five items, downloaded the PDF, and the twenty-fifth item was not in it. All items should appear in the PDF.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice PDF
- Actual result: The last line item, the twenty-fifth, is missing from the PDF.
- Expected result: All line items should appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system and app version were you using when you downloaded the PDF?; [general] A second request was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket for it?

Type check: not counted · latency 3992 ms · tokens 2423 in / 776 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 4

**Bug: Invoice PDF cuts off the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the PDF omits the last line item. The reporter made an invoice with twenty-five items, downloaded the PDF, and the twenty-fifth item was missing. All items should appear in the PDF.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice PDF
- Actual result: The twenty-fifth (last) line item is missing from the PDF.
- Expected result: All line items should appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] What browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second request was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket for it?

Type check: not counted · latency 3548 ms · tokens 2423 in / 748 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

### NOISY-01 (expected Bug)

> Okay, so, um, I was working on, uh, on Tuesday, no wait, Wednesday, it was Wednesday, and I tried to find an invoice, you know, the way I always do, in the search box on the invoice list. And I typed the full invoice number, INV-0042, and it found nothing. Like, nothing. Which is weird, because, um, if I search by the customer's name it works completely fine. This is in Ledgerly 3.8, no, sorry, 3.9. And I'm using Firefox. Anyway, I'd expect it to just show that invoice. Yeah. Sorry, that was a bit long.

Facts that must appear:
- Searching for the full invoice number INV-0042 in the invoice list search box returns nothing
- Searching by customer name works
- Expected: the invoice is shown
- Environment: Ledgerly 3.9, Firefox

Missing information expected: none
Traps: `3.8` (Self-corrected to 3.9); `Tuesday` (Self-corrected to Wednesday); `Chrome` (Only Firefox was mentioned); `Windows` (No operating system was mentioned)

#### NOISY-01 · run 1

**Bug: Invoice list search finds nothing for full invoice number INV-0042**

Searching the invoice list for the full invoice number INV-0042 returns no results, while searching by customer name works. Reported on Ledgerly 3.9 in Firefox.

- Steps to reproduce: Open the invoice list. | Type the full invoice number INV-0042 into the search box.
- Actual result: Searching for INV-0042 finds nothing.
- Expected result: The search should show invoice INV-0042.
- Environment: Ledgerly 3.9, Firefox

Missing information: [bug.environment] Which Firefox version and operating system were you using?; [general] Does invoice INV-0042 exist and appear in the invoice list when you browse without searching?

Type check: not counted · latency 5835 ms · tokens 2489 in / 1065 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 2

**Bug: Invoice search returns no results when searching by full invoice number INV-0042 in Ledgerly 3.9 on Firefox**

Searching for a full invoice number (INV-0042) in the invoice list search box returns no results, while searching by customer name works. The reporter expects the matching invoice to be shown.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing.
- Expected result: The invoice INV-0042 is shown in the results.
- Environment: Ledgerly 3.9, Firefox. Searching by customer name works correctly.

Missing information: [bug.stepsToReproduce] Did you press enter or wait for the results to update after typing the invoice number?; [bug.environment] Which Firefox version and operating system were you using?; [general] Is 'Ledgerly 3.9' the correct version? You first said 3.8 and then corrected it to 3.9; please confirm 3.9.; [bug.expectedResult] Does INV-0042 exist and is it visible in the invoice list without any search applied?

Type check: not counted · latency 2389 ms · tokens 2489 in / 431 out
- **Trap hit:** `3.8` in missingInformation (only in questions)

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 3

**Bug: Invoice search finds nothing when searching by full invoice number INV-0042**

In the invoice list search box, typing the full invoice number INV-0042 returns no results. Searching by the customer's name works correctly. This was observed in Ledgerly 3.9 on Firefox.

- Steps to reproduce: Open the invoice list in Ledgerly 3.9 | Type the full invoice number INV-0042 into the search box | Observe that no results are shown
- Actual result: Searching for the full invoice number INV-0042 finds nothing. Searching by customer name works.
- Expected result: The search should show the invoice INV-0042.
- Environment: Ledgerly 3.9, Firefox (version not provided)

Missing information: [bug.stepsToReproduce] Does invoice INV-0042 exist, and did you search from the invoice list page?; [bug.environment] Which Firefox version and operating system were you using?

Type check: not counted · latency 5118 ms · tokens 2489 in / 1001 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 4

**Bug: Invoice search by full invoice number INV-0042 returns no results in Ledgerly 3.9**

In Ledgerly 3.9 using Firefox, searching the invoice list for the full invoice number INV-0042 returns nothing. Searching by customer name works correctly. The reporter expected the search to show that invoice.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing for INV-0042.
- Expected result: The search should show invoice INV-0042.
- Environment: Ledgerly 3.9 in Firefox. Firefox version and operating system not stated.

Missing information: [bug.environment] Which version of Firefox and which operating system were you using?; [bug.stepsToReproduce] Did you press Enter or click a button to run the search after typing the number?

Type check: not counted · latency 5573 ms · tokens 2489 in / 1143 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 
