# Scoring sheet

Fill in the empty fields for every ticket (plan 7.3). Invention: `none`, `minor` or `critical` (critical = changes the meaning or adds a wrong concrete detail). Usability: `usable`, `minor edit` or `rewrite`.
A trap hit that is only inside a missing-information question may merely mention the term: judge it, do not count it automatically.

## claude-sonnet-5-5

Provider `Claude` · scenarios `eval-scenarios-v1` (hash `45492e444349`) · prompt hash `31c6b80c09d1` · commit `d15676f` (uncommitted changes) · started 2026-11-11 12:44 +02:00

### AMBIGUOUS-01 (expected Bug)

> When I change a customer's currency from euro to dollars, their old invoices still show euros. I'm not sure if that's wrong or if it's meant to work like that, because maybe finance wants old invoices to stay as they were. But somebody should probably look at it.

Facts that must appear:
- Changing a customer's currency from euro to dollars leaves their old invoices showing euros
- The reporter is unsure whether this is wrong or intended
- Finance may want old invoices to stay unchanged

Missing information expected: general: is this a defect or a requested change in behaviour?
Traps: `exchange rate` (No conversion was mentioned); `tax` (Tax was not mentioned); `rounding` (Not mentioned); `Chrome` (No browser was mentioned)

#### AMBIGUOUS-01 · run 1

**Bug: Old invoices still show euros after customer currency changed to dollars**

After a customer's currency is changed from euro to dollars, their existing invoices still display euros. The reporter is unsure whether this is incorrect or intended, since finance may want old invoices to stay unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: The customer's old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this a bug or intended behavior (finance may want old invoices to keep their original currency)? Or is a change in behavior being requested?; [bug.expectedResult] What currency should old invoices show after the customer's currency is changed, if any change is wanted?; [bug.environment] In which environment, application version or browser did you see this?

Type check: not counted · latency 4371 ms · tokens 2369 in / 339 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 2

**Bug: Old invoices still show euros after customer currency changed to dollars**

After a customer's currency is changed from euro to dollars, their existing invoices still display euros. The reporter is unsure whether this is incorrect or intended, since finance may want old invoices to stay unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | Look at the customer's old invoices
- Actual result: The customer's old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this a bug or intended behavior, since finance may want old invoices to keep their original currency? Or do you want a change in behavior?; [bug.expectedResult] What currency should the old invoices show after the customer's currency is changed?; [bug.environment] In which environment, application or version did you see this?

Type check: not counted · latency 3493 ms · tokens 2369 in / 331 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 3

**Bug: Old invoices still show euros after customer currency changed to dollars**

After a customer's currency is changed from euro to dollars, their old invoices still display euros. The reporter is unsure whether this is a defect or intended behaviour, since finance may want old invoices to stay unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: The customer's old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this a bug, or intended behaviour where old invoices keep their original currency? Is a change to this behaviour being requested?; [bug.expectedResult] What should happen to a customer's old invoices when their currency is changed?; [bug.environment] In which environment, application version or browser did you see this?

Type check: not counted · latency 2911 ms · tokens 2369 in / 331 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 4

**Bug: Old invoices still show euros after customer currency changed to dollars**

After a customer's currency is changed from euro to dollars, their old invoices still display euros. The speaker is unsure whether this is wrong or intended, since finance may want old invoices to stay unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: The customer's old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this a bug or intended behavior (finance may want old invoices to keep the original currency), or is a change to this behavior requested?; [bug.expectedResult] What currency should old invoices show after the customer's currency is changed?; [bug.environment] In which environment, application version or browser did you see this?

Type check: not counted · latency 2706 ms · tokens 2369 in / 327 out

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

**Bug: CSV export with Overdue status filter contains only header row**

Exporting the invoice list to CSV after filtering by status Overdue produces a file with only the header row and no invoices. Exporting without the filter works fine.

- Steps to reproduce: Open the invoice list | Filter by status Overdue, which shows twelve invoices | Click Export CSV
- Actual result: The file downloads but contains only the header row and no invoices. Exporting without the filter works fine.
- Expected result: The file contains the twelve overdue invoices shown by the filter.
- Environment: Ledgerly version 3.8.2, Chrome 126, Windows 11

Missing information: [general] Is 'Ledgerly' the correct name of the application?

Type check: match · latency 3469 ms · tokens 2428 in / 284 out

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

**Bug: Invoice editor closes and discards changes when saving with empty due date**

When an existing invoice is opened, the due date field is cleared and Save is pressed, the editor closes and all unsaved changes are lost. The speaker says it happens every time.

- Steps to reproduce: Open an existing invoice | Clear the due date field | Press Save
- Actual result: The whole editor closes and all unsaved changes are lost. This happens every time.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should happen when saving an invoice with an empty due date (e.g. a validation message, or saving without a due date)?; [bug.environment] Which browser, operating system, or app version were you using when this happened?

Type check: match · latency 2582 ms · tokens 2352 in / 295 out

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

**Bug: Revenue chart on the dashboard shows nothing**

The revenue chart on the dashboard is broken and displays nothing.

- Steps to reproduce: none
- Actual result: The revenue chart on the dashboard shows nothing.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.stepsToReproduce] What steps lead to the empty revenue chart (for example, opening the dashboard, selecting a date range)?; [bug.expectedResult] What should the revenue chart display?; [bug.environment] Which browser, operating system, device or environment does this happen in?

Type check: match · latency 2074 ms · tokens 2313 in / 258 out
- **Trap hit:** `empty` in missingInformation (only in questions)

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

Some customers on the production system get the payment reminder email twice. No pattern has been identified, and it started after last week's update.

- Steps to reproduce: none
- Actual result: Some customers receive the payment reminder email twice. The affected customers show no visible pattern.
- Expected result: The reminder is sent once, three days before the due date.
- Environment: Production system, started after the update last week.

Missing information: [bug.stepsToReproduce] What steps or conditions trigger the duplicate reminder, if known?

Type check: match · latency 2099 ms · tokens 2359 in / 224 out

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

**Feature: Bulk action to mark selected invoices as paid in the invoice list**

Accountants currently mark invoices as paid one by one after every bank import, which is slow. The speaker requests a bulk Mark as paid action for invoices selected in the invoice list.

- User need: Accountants mark invoices as paid one by one after every bank import, and it takes a long time.
- Proposed behavior: In the invoice list, users select several invoices with the checkboxes. As soon as at least one is selected, a Mark as paid button appears. Clicking it opens a confirmation dialog showing how many invoices will be changed. The paid date is set to today by default. Invoices that are already paid are skipped and not changed.
- Acceptance criteria: The invoice list has checkboxes that allow selecting several invoices. | A button called Mark as paid appears as soon as at least one invoice is selected. | Clicking Mark as paid opens a confirmation dialog that shows how many invoices will be changed. | The paid date is set to today by default. | Invoices that are already paid are skipped and not changed.

Missing information: none

Type check: match · latency 3315 ms · tokens 2448 in / 391 out

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

**Feature: Add dark mode toggle in user menu for Ledgerly**

Users working late in the evening find the white screen hard on the eyes. The speaker wants a dark mode that can be switched on and off from the user menu and is remembered at the next login.

- User need: Users who work late in the evening find the white screen hard on the eyes.
- Proposed behavior: Add a switch in the user menu to turn dark mode on and off. The app remembers the user's choice the next time they log in.
- Acceptance criteria: The user menu contains a switch to turn dark mode on and off. | After the user chooses a mode, the app uses that mode at the next login.

Missing information: none

Type check: match · latency 2178 ms · tokens 2373 in / 248 out

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

**Feature: Make invoices more customizable to match customer branding**

Customers have asked for invoices that are more customizable so they feel like their own brand. The speaker is not sure what this should look like and wants it investigated.

- User need: Customers want invoices that feel more like their own brand.
- Proposed behavior: Not provided
- Acceptance criteria: none

Missing information: [feature.proposedBehavior] What invoice elements should customers be able to customize (for example logo, colors, fonts, layout)?; [feature.acceptanceCriteria] What would show that the invoice customization works?

Type check: match · latency 3370 ms · tokens 2353 in / 240 out
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

**Bug: Last line item cut off in invoice PDF when invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The speaker saw this with an invoice of twenty-five items, where the twenty-fifth item was absent.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF | Check the line items in the PDF
- Actual result: The last line item (the twenty-fifth) is cut off and missing from the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which environment, browser, operating system or version was used when this happened?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket?; [general] Does the last item get cut off with any invoice of more than twenty items, or was it only seen with twenty-five? Is exactly twenty-one the threshold?

Type check: not counted · latency 3700 ms · tokens 2423 in / 395 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 2

**Bug: Last line item cut off in invoice PDF when invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The speaker created an invoice with twenty-five items and the twenty-fifth was missing.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF | Check the line items in the PDF
- Actual result: The last line item (the twenty-fifth) is cut off and missing from the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket?

Type check: not counted · latency 2707 ms · tokens 2423 in / 334 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 3

**Bug: Last line item cut off in invoice PDF when invoice has more than twenty line items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The reporter created an invoice with twenty-five items and the twenty-fifth was missing.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF | Check the line items in the PDF
- Actual result: The last line item (the twenty-fifth) is cut off and missing from the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket?

Type check: not counted · latency 2540 ms · tokens 2423 in / 335 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 4

**Bug: Last line item cut off in invoice PDF when invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The reporter created an invoice with twenty-five items and the twenty-fifth was missing.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF | Check the line items in the PDF
- Actual result: The last line item (the twenty-fifth) is cut off and missing from the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket?

Type check: not counted · latency 2499 ms · tokens 2423 in / 334 out

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

**Bug: Invoice list search returns nothing when searching by full invoice number**

Searching for a full invoice number (INV-0042) in the invoice list search box returns no results. Searching by customer name works correctly.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing. Searching by customer name works fine.
- Expected result: The invoice with the entered number is shown.
- Environment: Ledgerly 3.9, Firefox

Missing information: [general] Is 'Ledgerly' the correct name of the product?; [bug.environment] Which Firefox version and operating system are you using?

Type check: not counted · latency 2306 ms · tokens 2489 in / 271 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 2

**Bug: Invoice list search returns no results when searching by full invoice number**

Searching for the full invoice number INV-0042 in the invoice list search box returns nothing. Searching by customer name works correctly.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing for INV-0042. Searching by customer name works fine.
- Expected result: The search shows the invoice with the entered invoice number.
- Environment: Ledgerly 3.9, Firefox

Missing information: [general] Is 'Ledgerly' the correct name of the product?; [bug.environment] Which Firefox version and operating system were you using?

Type check: not counted · latency 2423 ms · tokens 2489 in / 280 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 3

**Bug: Invoice list search returns no results when searching by full invoice number**

Searching the invoice list by a full invoice number (INV-0042) returns nothing, while searching by customer name works. Reported in Ledgerly 3.9 on Firefox.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing. Searching by customer name works fine.
- Expected result: The invoice with that number is shown.
- Environment: Ledgerly 3.9, Firefox

Missing information: [general] Is 'Ledgerly' the correct name of the product?; [bug.environment] Which operating system and Firefox version were you using?

Type check: not counted · latency 2324 ms · tokens 2489 in / 284 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 4

**Bug: Invoice list search returns nothing when searching by full invoice number**

Searching the invoice list for the full invoice number INV-0042 returns no results. Searching by customer name works correctly.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing. Searching by customer name works fine.
- Expected result: The search shows the invoice with the entered invoice number.
- Environment: Ledgerly 3.9, Firefox

Missing information: [bug.environment] Which Firefox version and operating system are you using?; [general] Is 'Ledgerly' the correct name of the application?

Type check: not counted · latency 2203 ms · tokens 2489 in / 271 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

## claude-haiku-5-5

Provider `Claude` · scenarios `eval-scenarios-v1` (hash `45492e444349`) · prompt hash `31c6b80c09d1` · commit `d15676f` (uncommitted changes) · started 2026-11-11 12:44 +02:00

### AMBIGUOUS-01 (expected Bug)

> When I change a customer's currency from euro to dollars, their old invoices still show euros. I'm not sure if that's wrong or if it's meant to work like that, because maybe finance wants old invoices to stay as they were. But somebody should probably look at it.

Facts that must appear:
- Changing a customer's currency from euro to dollars leaves their old invoices showing euros
- The reporter is unsure whether this is wrong or intended
- Finance may want old invoices to stay unchanged

Missing information expected: general: is this a defect or a requested change in behaviour?
Traps: `exchange rate` (No conversion was mentioned); `tax` (Tax was not mentioned); `rounding` (Not mentioned); `Chrome` (No browser was mentioned)

#### AMBIGUOUS-01 · run 1

**Bug: Old invoices still show euros after customer currency is changed to dollars**

When a customer's currency is changed from euro to dollars, their existing invoices still display euros. The reporter is unsure whether this is incorrect or intended, since finance may want old invoices to remain unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | Open one of the customer's existing invoices
- Actual result: Old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should the old invoices show after the currency change: dollars, or euros as they were issued?; [bug.environment] What system, version, or environment were you using when this happened?; [general] Is this a bug or intended behaviour? The report says finance may want old invoices to stay unchanged. Should this be tracked as a Feature instead?

Type check: not counted · latency 3251 ms · tokens 2369 in / 644 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 2

**Bug: Old invoices still show euro after a customer's currency is changed to dollars**

When a customer's currency is changed from euro to dollars, their existing invoices still show euros. The reporter is unsure whether this is wrong or intended, since finance may want old invoices to keep their original currency.

- Steps to reproduce: Change a customer's currency from euro to dollars | Open one of the customer's old invoices
- Actual result: Old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] Should old invoices show dollars after the currency change, or should they keep euros as they were issued?; [bug.environment] Which application, version, or environment was this seen in?; [general] Is this a bug in existing behaviour or a request to change how currency is handled on old invoices? The report suggests it may be intended behaviour for finance.

Type check: not counted · latency 3925 ms · tokens 2369 in / 726 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 3

**Bug: Old invoices still show euros after changing customer currency to dollars**

After a customer's currency is changed from euro to dollars, their existing invoices still show euros. The reporter is not sure whether this is wrong or intended, since finance may want old invoices to keep their original currency.

- Steps to reproduce: Change a customer's currency from euro to dollars
- Actual result: Old invoices for the customer still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should the old invoices show after the currency change?; [bug.environment] Which system, version or environment was this seen in?; [general] Is this a bug, or is keeping old invoices in their original currency the intended behaviour?

Type check: not counted · latency 3675 ms · tokens 2369 in / 731 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 4

**Bug: Old invoices still show euros after a customer's currency is changed to dollars**

After a customer's currency is changed from euro to dollars, their existing invoices still display euros. The reporter is unsure whether this is wrong or intended, since finance may want old invoices to remain unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: Old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] Should old invoices show dollars after the currency change, or should they keep euros as they were issued?; [bug.environment] Which system, environment, or version were you using when this happened?; [general] Is this a bug or intended behaviour? The report suggests finance may want old invoices to keep their original currency, so this may be a feature or a policy decision rather than a defect.

Type check: not counted · latency 3366 ms · tokens 2369 in / 644 out

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

**Bug: CSV export contains only the header row when invoice list is filtered by status Overdue**

When the invoice list is filtered by status Overdue, which shows twelve invoices, clicking Export CSV downloads a file that contains only the header row and no invoices. Exporting without the filter works correctly.

- Steps to reproduce: Open the invoice list | Filter by status Overdue, which shows twelve invoices | Click Export CSV
- Actual result: The file downloads but contains only the header row, with no invoices.
- Expected result: A file with the twelve overdue invoices.
- Environment: Ledgerly version 3.8.2, Chrome 126, Windows 11

Missing information: [general] Is 'Ledgerly' the correct name of the product?

Type check: match · latency 1590 ms · tokens 2428 in / 290 out

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

**Bug: Editor closes and unsaved changes are lost when saving an existing invoice with a cleared due date**

When an existing invoice is opened, the due date field is cleared and Save is pressed, the whole editor closes and all unsaved changes are lost. The reporter says this happens every time.

- Steps to reproduce: Open an existing invoice | Clear the due date field | Press Save
- Actual result: The whole editor closes and all unsaved changes are lost. It happens every time.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should happen when Save is pressed with the due date cleared?; [bug.environment] Which browser, operating system, or app version were you using?

Type check: match · latency 1977 ms · tokens 2352 in / 286 out

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

**Bug: Revenue chart on the dashboard shows nothing**

The revenue chart on the dashboard is broken and displays no data. Steps, expected result and environment were not provided.

- Steps to reproduce: none
- Actual result: The revenue chart on the dashboard shows nothing.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.stepsToReproduce] What steps lead to the revenue chart showing nothing?; [bug.expectedResult] What should the revenue chart show instead?; [bug.environment] Which browser, operating system, or device are you using, and which version?

Type check: match · latency 1392 ms · tokens 2313 in / 258 out

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

**Failed:** `llm_invalid_output` — The ticket breaks these rules: bug.stepsToReproduce[0] is empty or "Not provided".

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

Accountants currently mark invoices as paid one by one after each bank import, which is slow. Add a bulk action in the invoice list: select several invoices with checkboxes, then use a Mark as paid button that appears once at least one is selected, with a confirmation dialog showing how many invoices will change, paid date defaulting to today, and already paid invoices skipped.

- User need: Accountants need to mark many invoices as paid at once after each bank import, because marking them one by one takes a long time.
- Proposed behavior: In the invoice list, show a checkbox for each invoice so several can be selected. When at least one invoice is selected, show a button called Mark as paid. Clicking it opens a confirmation dialog that shows how many invoices will be changed. The paid date is set to today by default. Invoices that are already paid are skipped and not changed.
- Acceptance criteria: The invoice list shows a checkbox for each invoice. | The Mark as paid button appears when at least one invoice is selected and is hidden when none are selected. | Clicking Mark as paid opens a confirmation dialog that shows the number of invoices that will be changed. | The paid date defaults to today's date. | Invoices that are already paid are not changed when the action is confirmed.

Missing information: [title] Is the title correct, or should it name the invoice list or the bank import more specifically?; [feature.userNeed] Is the user need correct as stated, or should another role besides accountants be included?; [general] Should the paid date be editable in the confirmation dialog, or is today's date fixed?; [general] Should the bulk action also be available outside the invoice list, for example after a bank import?

Type check: match · latency 3562 ms · tokens 2448 in / 620 out

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

**Feature: Add dark mode toggle in user menu that persists after login**

Add a dark mode switch in the user menu so users can turn dark mode on and off. The app should remember the choice the next time the user logs in. The speaker says many users work late in the evening and the white screen is hard on the eyes.

- User need: A lot of users work late in the evening and the white screen is hard on the eyes.
- Proposed behavior: Add a switch in the user menu to turn dark mode on and off, and have the app remember the user's choice the next time they log in.
- Acceptance criteria: A dark mode switch is available in the user menu. | Turning the switch on changes the app to dark mode. | Turning the switch off returns the app to the default light mode. | After the user logs in again, the app uses the dark mode setting the user last chose.

Missing information: none

Type check: match · latency 4017 ms · tokens 2373 in / 683 out

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

Customers have asked for more customizable invoices so they feel more like their own brand. The speaker is not sure what the customization should look like and wants it investigated.

- User need: Customers want invoices that feel more like their own brand.
- Proposed behavior: Not provided
- Acceptance criteria: none

Missing information: [feature.proposedBehavior] What specific invoice customizations should be possible, such as logo, colors, or layout?; [feature.acceptanceCriteria] What would show that the feature works, for example which invoice elements a customer can change and where the change appears?; [feature.userNeed] Which customers or customer groups are asking for this, and is there a specific reason they need it?

Type check: match · latency 2301 ms · tokens 2353 in / 296 out

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

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The reporter created an invoice with twenty-five items and the twenty-fifth was absent, and all items should appear in the PDF.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF | Check the line items in the PDF
- Actual result: The last line item (the twenty-fifth) is cut off and missing from the PDF.
- Expected result: All line items appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] What browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate feature ticket for it?

Type check: not counted · latency 4291 ms · tokens 2423 in / 655 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 2

**Bug: Invoice PDF cuts off the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the PDF is missing the last item. A twenty-five item invoice produced a PDF without its twenty-fifth item, and all items should appear.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice PDF
- Actual result: The twenty-fifth (last) line item is missing from the PDF.
- Expected result: All line items should appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second request was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket for it?

Type check: not counted · latency 3667 ms · tokens 2423 in / 705 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 3

**Bug: Invoice PDF cuts off last line item when invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The reporter created an invoice with twenty-five items and the twenty-fifth item did not appear in the PDF.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as PDF | Check the line items in the PDF
- Actual result: The last line item is cut off in the PDF. The twenty-fifth item was missing.
- Expected result: All line items should appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] What environment did you use (browser, operating system, app version, or device)?; [general] A second request was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket for it?

Type check: not counted · latency 4230 ms · tokens 2423 in / 798 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 4

**Bug: Invoice PDF cuts off the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The reporter created an invoice with twenty-five items, downloaded the PDF, and the twenty-fifth item was absent.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF
- Actual result: The last line item (the twenty-fifth) is missing from the PDF.
- Expected result: All line items should appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second request was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket for it?

Type check: not counted · latency 3098 ms · tokens 2423 in / 608 out

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

**Bug: Invoice list search returns nothing for full invoice number INV-0042**

Searching the invoice list for the full invoice number INV-0042 returns no results. Searching by customer name works correctly in the same search box.

- Steps to reproduce: Open the invoice list in Ledgerly 3.9 using Firefox | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing for INV-0042.
- Expected result: The search shows the invoice INV-0042.
- Environment: Ledgerly 3.9, Firefox (version and operating system not provided)

Missing information: [bug.environment] What version of Firefox and which operating system are you using?; [bug.stepsToReproduce] Does the invoice INV-0042 exist in the invoice list, and does it appear there when you scroll or filter without searching?

Type check: not counted · latency 5110 ms · tokens 2489 in / 944 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 2

**Bug: Searching the invoice list by full invoice number INV-0042 returns no results**

Typing the full invoice number INV-0042 into the search box on the invoice list finds nothing, while searching by customer name works. The reporter expected the search to show that invoice.

- Steps to reproduce: Type the full invoice number INV-0042 into the search box on the invoice list
- Actual result: The search finds nothing for INV-0042.
- Expected result: The search shows invoice INV-0042.
- Environment: Ledgerly 3.9, Firefox

Missing information: [bug.environment] What is the Firefox version and the operating system?; [bug.stepsToReproduce] Did you open the invoice list first, and were there any filters applied when you searched?; [general] Does invoice INV-0042 exist and is it visible in the invoice list when you browse without searching?

Type check: not counted · latency 4517 ms · tokens 2489 in / 915 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 3

**Bug: Invoice list search finds nothing when the full invoice number INV-0042 is entered**

Searching the invoice list by the full invoice number INV-0042 returns no results, although searching by customer name works. The speaker expected the search to show that invoice. The report was made in Ledgerly 3.9 using Firefox.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box | Observe the search results
- Actual result: The search finds nothing for INV-0042.
- Expected result: The search shows invoice INV-0042.
- Environment: Ledgerly 3.9, Firefox. Operating system and Firefox version not provided.

Missing information: [bug.environment] What operating system and Firefox version were you using?; [bug.stepsToReproduce] Does invoice INV-0042 exist in the list, and do other full invoice numbers also return no results?; [general] Is 'Ledgerly' the correct product name, and is the version 3.9?

Type check: not counted · latency 4888 ms · tokens 2489 in / 987 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 4

**Bug: Invoice list search finds nothing for full invoice number INV-0042, while customer name search works**

Searching the invoice list by the full invoice number INV-0042 returns no results, although the invoice exists. Searching by the customer's name works correctly. The reporter expected the invoice to be shown.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search returns no results for INV-0042.
- Expected result: The invoice INV-0042 should be shown.
- Environment: Ledgerly 3.9, Firefox

Missing information: [bug.environment] What is the Firefox version and the operating system?; [bug.stepsToReproduce] Does the search fail every time for INV-0042, and does it also fail for other invoice numbers?

Type check: not counted · latency 4687 ms · tokens 2489 in / 891 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 
