# Scoring sheet

Fill in the empty fields for every ticket (plan 7.3). Invention: `none`, `minor` or `critical` (critical = changes the meaning or adds a wrong concrete detail). Usability: `usable`, `minor edit` or `rewrite`.
A trap hit that is only inside a missing-information question may merely mention the term: judge it, do not count it automatically.
Audio path: transcripts from `Systran/faster-whisper-medium.en` (language `en`). Pooled word error rate against the scripts: 5,1%. Tickets made from the transcripts are in the blocks "from audio" below; score them like the others.

## claude-sonnet-5-5

Provider `Claude` · scenarios `eval-scenarios-v1` (hash `45492e444349`) · prompt hash `31c6b80c09d1` · commit `b02209c` (uncommitted changes) · started 2026-11-11 14:29 +02:00

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

**Bug: Old invoices still show euros after customer currency changed to dollars**

After a customer's currency is changed from euro to dollars, their old invoices still display euros. The speaker is unsure whether this is wrong or intended, since finance may want old invoices to stay unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: The customer's old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this a bug or intended behavior (finance may want old invoices to keep their original currency)? Or is a change in behavior being requested?; [bug.expectedResult] What should the old invoices show after the currency change, if anything different?; [bug.environment] In which environment, application or version did you see this?

Type check: not counted · latency 3958 ms · tokens 2369 in / 326 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 2

**Bug: Old invoices still show euros after customer currency changed to dollars**

After a customer's currency is changed from euro to dollars, their existing invoices still display euros. The speaker is unsure whether this is a defect or intended behaviour, since finance may want old invoices to remain unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: The customer's old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this a bug, or is it intended behaviour so that old invoices stay as they were (for example, a requirement from finance)?; [bug.expectedResult] What should old invoices show after the customer's currency is changed?; [bug.environment] In which application, version or environment did you see this?

Type check: not counted · latency 3601 ms · tokens 2369 in / 327 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 3

**Bug: Old invoices still show euros after customer currency changed to dollars**

After a customer's currency is changed from euro to dollars, their old invoices still display euros. The speaker is unsure whether this is wrong or intended, since finance may want old invoices to stay unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: The customer's old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this a bug, or is it intended behaviour so that old invoices stay as they were? Or do you want a new or changed behaviour for old invoices?; [bug.expectedResult] What should happen to a customer's old invoices when their currency is changed?; [bug.environment] In which environment, application version or browser did you see this?

Type check: not counted · latency 2778 ms · tokens 2369 in / 335 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 4

**Bug: Old invoices still show euros after customer currency changed to dollars**

After a customer's currency is changed from euro to dollars, their old invoices still display euros. The speaker is unsure whether this is wrong or intended, since finance may want old invoices to remain unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: The customer's old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this a bug, or is it intended behavior so that old invoices stay unchanged? Or is a change in behavior being requested?; [bug.expectedResult] What currency should old invoices show after the customer's currency is changed, if this is not intended?; [bug.environment] In which environment, application or version did you see this?

Type check: not counted · latency 2697 ms · tokens 2369 in / 332 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · from audio

STT transcript (4411 ms):

> When I change a customer's currency from euro to dollars, their old invoices still show euros. I'm not sure if that's wrong or if it's meant to work like that, because maybe finance wants old invoices to stay as they are. But somebody should probably look at it.

Word error rate: 2,1% (1 substituted, 0 missing, 0 extra, of 48 words in the script)
Script path type (run 1): Bug

**Bug: Old invoices still show euros after customer currency changed to dollars**

After a customer's currency is changed from euro to dollars, their old invoices still display euros. The speaker is unsure whether this is wrong or intended, since finance may want old invoices to stay unchanged.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: The customer's old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [general] Is this a bug or intended behaviour (finance may want old invoices to stay unchanged), or is a change to how currency changes affect old invoices being requested?; [bug.expectedResult] What should old invoices show after the currency change?; [bug.environment] In which environment or version did you see this?

Type check: not counted · latency 3265 ms · tokens 2369 in / 325 out

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

**Bug: CSV export with Overdue status filter contains only the header row**

When the invoice list is filtered by status Overdue and exported with Export CSV, the downloaded file contains only the header row. Exporting without the filter works fine.

- Steps to reproduce: Open the invoice list | Filter by status Overdue, which shows twelve invoices | Click Export CSV
- Actual result: The file downloads but contains only the header row and no invoices. Exporting without the filter works fine.
- Expected result: The file contains the twelve overdue invoices shown in the filtered list.
- Environment: Ledgerly version 3.8.2, Chrome 126, Windows 11

Missing information: [general] Is 'Ledgerly' the correct name of the application?

Type check: match · latency 2696 ms · tokens 2428 in / 288 out

- Facts present: __ of 5
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### BUG-01 · from audio

STT transcript (7136 ms):

> Hi, I found a bug in the CSV export. I'm on ledgerly version 3.8.2 using Chrome 126 on Windows 11. I open the invoice list, filter by status overdue, which shows 12 invoices, and then click Export CSV. The file downloads, but it only contains the header row. No invoices at all. What I expect is a file with those 12 overdue invoices. If I export without the filter, it works fine.

Word error rate: 2,8% (2 substituted, 0 missing, 0 extra, of 72 words in the script)
Script path type (run 1): Bug

**Bug: CSV export of filtered overdue invoice list contains only the header row**

Exporting the invoice list to CSV after filtering by status overdue produces a file with only the header row and no invoices. Exporting without the filter works fine.

- Steps to reproduce: Open the invoice list | Filter by status overdue, which shows 12 invoices | Click Export CSV
- Actual result: The file downloads but contains only the header row and no invoices. Exporting without the filter works fine.
- Expected result: The file contains the 12 overdue invoices shown by the filter.
- Environment: ledgerly version 3.8.2, Chrome 126, Windows 11

Missing information: [general] Is 'ledgerly' the correct name of the application?

Type check: match · latency 2178 ms · tokens 2426 in / 284 out

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

**Bug: Invoice editor closes and discards changes when saving with an empty due date**

When an existing invoice is opened, the due date field is cleared and Save is pressed, the editor closes and all unsaved changes are lost. The reporter says this happens every time.

- Steps to reproduce: Open an existing invoice | Clear the due date field | Press Save
- Actual result: The whole editor closes and all unsaved changes are lost. This happens every time.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should happen when Save is pressed with an empty due date (e.g. a validation message and the editor stays open)?; [bug.environment] Which browser, operating system, or app version are you using?

Type check: match · latency 2379 ms · tokens 2352 in / 291 out

- Facts present: __ of 3
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### BUG-02 · from audio

STT transcript (4048 ms):

> There is a problem when saving invoices. If I open an existing invoice, clear the date field and press save, the whole editor just closes and all of my unsaved changes are gone. It happens every time I try it.

Word error rate: 10,3% (1 substituted, 1 missing, 2 extra, of 39 words in the script)
Script path type (run 1): Bug

**Bug: Invoice editor closes and discards changes when saving with an empty date field**

When an existing invoice is opened, the date field is cleared and save is pressed, the editor closes and all unsaved changes are lost. The speaker says this happens every time.

- Steps to reproduce: Open an existing invoice | Clear the date field | Press save
- Actual result: The whole editor closes and all unsaved changes are lost. It happens every time.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should happen when saving an invoice with an empty date field (for example, a validation message with the editor staying open)?; [bug.environment] Which browser, operating system, device or application version were you using?

Type check: match · latency 2403 ms · tokens 2351 in / 287 out

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

The revenue chart on the dashboard is broken and displays nothing.

- Steps to reproduce: none
- Actual result: The revenue chart on the dashboard shows nothing.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.stepsToReproduce] What steps lead to the revenue chart showing nothing?; [bug.expectedResult] What should the revenue chart display?; [bug.environment] Which browser, operating system, or environment is this happening in?

Type check: match · latency 1910 ms · tokens 2313 in / 240 out

- Facts present: __ of 1
- Expected missing flagged: __ of 3 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### BUG-03 · from audio

STT transcript (3163 ms):

> The revenue chart on the dashboard is broken. It just shows nothing.

Word error rate: 0,0% (0 substituted, 0 missing, 0 extra, of 12 words in the script)
Script path type (run 1): Bug

**Bug: Revenue chart on the dashboard shows nothing**

The revenue chart on the dashboard is broken and displays nothing.

- Steps to reproduce: none
- Actual result: The revenue chart on the dashboard shows nothing.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.stepsToReproduce] What steps lead to the empty revenue chart (for example, which page or filters are used)?; [bug.expectedResult] What should the revenue chart display?; [bug.environment] Which browser, operating system, or environment shows the problem?

Type check: match · latency 2079 ms · tokens 2313 in / 250 out
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

Some customers on the production system get the payment reminder email twice, with no visible pattern. This started after last week's update.

- Steps to reproduce: none
- Actual result: Some customers receive the payment reminder email twice. Not all customers are affected and no pattern is visible.
- Expected result: The reminder is sent once, three days before the due date.
- Environment: Production system, issue started after the update last week.

Missing information: [bug.stepsToReproduce] What steps or conditions trigger the duplicate reminder, if known?

Type check: match · latency 2081 ms · tokens 2359 in / 228 out

- Facts present: __ of 5
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### BUG-04 · from audio

STT transcript (4646 ms):

> Some of our customers are getting the payment reminder emailed twice. Not all of them, just some. And I can't see a pattern. The reminder should go out once, three days before the due date. This is on the production system and it started after the update last week.

Word error rate: 2,0% (1 substituted, 0 missing, 0 extra, of 49 words in the script)
Script path type (run 1): Bug

**Bug: Some customers receive the payment reminder email twice**

Some customers, not all, get the payment reminder emailed twice. The reporter sees no pattern. This is on production and started after last week's update.

- Steps to reproduce: none
- Actual result: Some customers receive the payment reminder email twice.
- Expected result: The reminder is sent once, three days before the due date.
- Environment: Production system; started after the update last week.

Missing information: [bug.stepsToReproduce] Is there a way to reproduce the duplicate reminder, for example a specific action or a specific customer or account setup?

Type check: match · latency 2130 ms · tokens 2360 in / 232 out

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

Accountants currently mark invoices as paid one by one after each bank import, which is slow. The reporter requests a bulk Mark as paid action for invoices selected in the invoice list.

- User need: Accountants mark invoices as paid one by one after every bank import, and it takes a long time.
- Proposed behavior: In the invoice list, the user selects several invoices using the checkboxes. As soon as at least one is selected, a button called Mark as paid appears. Clicking it opens a confirmation dialog that shows how many invoices will be changed. The paid date is set to today by default. Invoices that are already paid are skipped and not changed.
- Acceptance criteria: The invoice list has checkboxes that allow selecting several invoices. | A Mark as paid button appears as soon as at least one invoice is selected. | Clicking Mark as paid opens a confirmation dialog that shows how many invoices will be changed. | The paid date is set to today by default. | Invoices that are already paid are skipped and not changed.

Missing information: none

Type check: match · latency 3179 ms · tokens 2448 in / 394 out

- Facts present: __ of 6
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### FEATURE-01 · from audio

STT transcript (8133 ms):

> I'd like to request a bulk action for marking invoices as paid. Right now, our accountants mark them one by one after every bank import, and it takes ages. Here's what I would want. In the invoice list, there are checkboxes, so you can select several invoices. As soon as at least one is selected, a button called Mark as paid appears. Clicking it opens a confirmation dialog that shows how many invoices will be changed. The paid date is set to today by default and invoices that are already paid are skipped, not changed.

Word error rate: 2,1% (1 substituted, 0 missing, 1 extra, of 94 words in the script)
Script path type (run 1): Feature

**Feature: Bulk action to mark selected invoices as paid in the invoice list**

Accountants currently mark invoices as paid one by one after every bank import, which takes a long time. The request is a bulk Mark as paid action on the invoice list for selected invoices.

- User need: Accountants mark invoices as paid one by one after every bank import, and it takes a long time.
- Proposed behavior: In the invoice list, the existing checkboxes let users select several invoices. As soon as at least one is selected, a button called Mark as paid appears. Clicking it opens a confirmation dialog that shows how many invoices will be changed. The paid date is set to today by default. Invoices that are already paid are skipped and not changed.
- Acceptance criteria: Selecting at least one invoice in the invoice list shows a Mark as paid button. | Clicking Mark as paid opens a confirmation dialog that shows how many invoices will be changed. | The paid date is set to today by default. | Invoices that are already paid are skipped and not changed.

Missing information: none

Type check: match · latency 2794 ms · tokens 2448 in / 373 out

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

Users who work late in the evening find the white screen hard on the eyes. The speaker wants a dark mode that can be switched on and off from the user menu, with the choice remembered at the next login.

- User need: Users who work late in the evening find the white screen hard on the eyes.
- Proposed behavior: Add a switch in the user menu to turn dark mode on and off. The app remembers the user's choice the next time they log in.
- Acceptance criteria: The user menu contains a switch that turns dark mode on and off. | After the user chooses a mode, the app uses the same choice the next time the user logs in.

Missing information: none

Type check: match · latency 2267 ms · tokens 2373 in / 257 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### FEATURE-02 · from audio

STT transcript (4497 ms):

> Feature idea. A dark mode for leisurely. A lot of us work late in the evening and the white screen is hard on the eyes. I think there should be a switch in the user menu to turn dark mode on and off, and the app should remember my choice the next time I log in.

Word error rate: 1,8% (1 substituted, 0 missing, 0 extra, of 56 words in the script)
Script path type (run 1): Feature

**Feature: Add dark mode with a switch in the user menu**

The speaker requests a dark mode for 'leisurely' because the white screen is hard on the eyes when working late in the evening. A switch in the user menu should turn it on and off, and the choice should persist across logins.

- User need: Users who work late in the evening find the white screen hard on the eyes.
- Proposed behavior: Add a switch in the user menu to turn dark mode on and off. The app remembers the user's choice the next time they log in.
- Acceptance criteria: The user menu contains a switch that turns dark mode on and off. | After the user sets dark mode and logs in again, the app keeps the chosen setting.

Missing information: [general] Is 'leisurely' the correct name of the app or product?

Type check: match · latency 2283 ms · tokens 2371 in / 291 out

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

Customers have asked for invoices that are more customizable so they feel more like their own brand. The speaker is unsure what this should look like and wants it investigated.

- User need: Customers want invoices to feel more like their own brand.
- Proposed behavior: Not provided
- Acceptance criteria: none

Missing information: [feature.proposedBehavior] What specific invoice customization options should be offered (for example logo, colors, fonts, layout)?; [feature.acceptanceCriteria] What would show that the invoice customization works for customers?

Type check: match · latency 2694 ms · tokens 2353 in / 243 out
- **Trap hit:** `font` in missingInformation (only in questions)

- Facts present: __ of 3
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### FEATURE-03 · from audio

STT transcript (4220 ms):

> So, our customers keep asking whether we could make their invoices more customizable. They want them to feel like their own brand, you know? I'm not sure exactly what that should look like, but it would be good to look into it.

Word error rate: 4,7% (1 substituted, 1 missing, 0 extra, of 43 words in the script)
Script path type (run 1): Feature

**Feature: Make customer invoices more customizable to match their brand**

Customers have asked for more customizable invoices so that they feel like their own brand. The speaker is unsure what this should look like and wants it looked into.

- User need: Customers want their invoices to feel like their own brand.
- Proposed behavior: Not provided
- Acceptance criteria: none

Missing information: [feature.proposedBehavior] Which parts of the invoice should customers be able to customize (for example logo, colors, layout, text)?; [feature.acceptanceCriteria] What would show that the invoice customization works as intended?

Type check: match · latency 2587 ms · tokens 2352 in / 244 out

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

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The reporter created an invoice with twenty-five items and the twenty-fifth was missing.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF | Check the line items in the PDF
- Actual result: The last line item (the twenty-fifth) is cut off and missing from the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket?

Type check: not counted · latency 2967 ms · tokens 2423 in / 334 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 2

**Bug: Last line item cut off in invoice PDF when invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The reporter created an invoice with twenty-five items and the twenty-fifth was not in the PDF.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF | Check the line items in the PDF
- Actual result: The last line item (the twenty-fifth) is cut off and missing from the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate feature ticket?

Type check: not counted · latency 3331 ms · tokens 2423 in / 340 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 3

**Bug: Last line item cut off in invoice PDF when invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The speaker created an invoice with twenty-five items and the twenty-fifth was missing.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF
- Actual result: The last line item (the twenty-fifth) is cut off and missing in the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate feature ticket?

Type check: not counted · latency 2984 ms · tokens 2423 in / 325 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 4

**Bug: Last line item cut off in invoice PDF when invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The speaker created an invoice with twenty-five items and the twenty-fifth was missing.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF
- Actual result: The last line item (the twenty-fifth) is cut off and missing from the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket?

Type check: not counted · latency 2989 ms · tokens 2423 in / 323 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · from audio

STT transcript (7460 ms):

> Two things about the invoice PDF. First, there is a bug. When an invoice has more than 20 line items, the last line item is cut off in the PDF. I made one with 25 items, downloaded the PDF, and the 25th item was missing. All items should be in there, of course. Second, and this is more of a wish, it would be nice to have a custom footer note on invoices, like a thank you message or bank details.

Word error rate: 8,5% (4 substituted, 2 missing, 1 extra, of 82 words in the script)
Script path type (run 1): Bug

**Bug: Last line item cut off in invoice PDF when invoice has more than 20 items**

When an invoice has more than 20 line items, the last item is missing from the downloaded PDF. The speaker created an invoice with 25 items and the 25th was missing.

- Steps to reproduce: Create an invoice with 25 line items | Download the invoice as a PDF | Check the line items in the PDF
- Actual result: The last line item (the 25th) is cut off and missing from the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank you message or bank details. Create a separate feature ticket?

Type check: not counted · latency 3357 ms · tokens 2416 in / 322 out

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

**Bug: Invoice list search returns no results when searching by full invoice number**

Searching the invoice list by a full invoice number (INV-0042) returns nothing, while searching by customer name works correctly. This happens in Ledgerly 3.9 on Firefox.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing. Searching by customer name works fine.
- Expected result: The invoice matching the entered invoice number is shown.
- Environment: Ledgerly 3.9, Firefox

Missing information: [bug.environment] Which Firefox version and operating system are you using?; [general] Is 'Ledgerly' the correct name of the product?

Type check: not counted · latency 2555 ms · tokens 2489 in / 293 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 2

**Bug: Invoice list search returns no results when searching by full invoice number**

Searching for the full invoice number INV-0042 in the invoice list search box returns nothing. Searching by customer name works correctly.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing. Searching by customer name works fine.
- Expected result: The invoice with the searched number is shown.
- Environment: Ledgerly 3.9, Firefox

Missing information: [general] Is 'Ledgerly' the correct name of the application?; [bug.environment] Which Firefox version and operating system are you using?

Type check: not counted · latency 2040 ms · tokens 2489 in / 270 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 3

**Bug: Invoice list search returns no results when searching by full invoice number**

Searching for a full invoice number (INV-0042) in the search box on the invoice list returns nothing. Searching by customer name works correctly.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing. Searching by customer name works fine.
- Expected result: The invoice matching the entered invoice number is shown.
- Environment: Ledgerly 3.9, Firefox

Missing information: [general] Is 'Ledgerly' the correct name of the application?

Type check: not counted · latency 2042 ms · tokens 2489 in / 246 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 4

**Bug: Invoice list search returns no results when searching by full invoice number**

Searching for the full invoice number INV-0042 in the search box on the invoice list returns nothing. Searching by customer name works correctly.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing. Searching by customer name works fine.
- Expected result: The invoice with the searched number is shown.
- Environment: Ledgerly 3.9, Firefox

Missing information: [general] Is 'Ledgerly' the correct name of the product?; [bug.environment] Which Firefox version and operating system are you using?

Type check: not counted · latency 2018 ms · tokens 2489 in / 272 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · from audio

STT transcript (11544 ms):

> Okay, so, um, I was working on On Tuesday No, no, wait Wednesday, it was Wednesday and I tried to find an invoice You know the way I always do in the search box on the invoice list. And I typed the full invoice number like INB-0042. And it found nothing, like nothing, which is weird because if I search by customer's name, it works completely fine. This is in ledgerly 3.8. Oh, no, sorry, 3.9. Yes. And I'm using Firefox. Anyway, I will expect it to just show that invoice. Yeah. Sorry, that was a bit long.

Word error rate: 10,3% (2 substituted, 3 missing, 5 extra, of 97 words in the script)
Script path type (run 1): Bug

**Bug: Invoice list search returns no results when searching by full invoice number**

Searching the invoice list search box with a full invoice number (INB-0042) returns nothing, while searching by customer name works fine. The speaker expects the matching invoice to be shown.

- Steps to reproduce: Open the invoice list | Type the full invoice number INB-0042 into the search box
- Actual result: The search finds nothing. Searching by customer name works correctly.
- Expected result: The invoice with the searched number is shown.
- Environment: ledgerly 3.9, Firefox

Missing information: [general] Is 'ledgerly' the correct name of the product?; [bug.environment] Which Firefox version and operating system are you using?

Type check: not counted · latency 2591 ms · tokens 2481 in / 285 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

## claude-haiku-5-5

Provider `Claude` · scenarios `eval-scenarios-v1` (hash `45492e444349`) · prompt hash `31c6b80c09d1` · commit `b02209c` (uncommitted changes) · started 2026-11-11 14:29 +02:00

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

**Bug: Old invoices still show euros after a customer's currency is changed to dollars**

After a customer's currency is changed from euro to dollars, their old invoices still show euros. The reporter is unsure whether this is wrong or intended, since finance may want old invoices to stay as they were.

- Steps to reproduce: Change a customer's currency from euro to dollars
- Actual result: Old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.stepsToReproduce] What steps did you take to view the old invoices after the change?; [bug.expectedResult] Should old invoices show dollars after the change, or stay in euros?; [bug.environment] Which system, version or environment was this seen in?; [general] Is this a bug or intended behaviour, since finance may want old invoices kept as they were issued?

Type check: not counted · latency 4952 ms · tokens 2369 in / 1021 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 2

**Bug: Old invoices still show euros after customer currency is changed to dollars**

When a customer's currency is changed from euro to dollars, their existing invoices still display euros. The reporter is unsure whether this is wrong or intended, since finance may want old invoices to keep their original currency.

- Steps to reproduce: Change a customer's currency from euro to dollars | View the customer's old invoices
- Actual result: Old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should the old invoices show after the customer's currency is changed to dollars?; [bug.environment] What environment was this seen in, such as browser, operating system, app version, or whether it was production or a test system?; [general] Is this a bug or an intended behaviour that should be kept? The report could also be a feature request if finance wants old invoices to stay in their original currency by design. Which is it?

Type check: not counted · latency 3693 ms · tokens 2369 in / 717 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 3

**Bug: Old invoices still show euros after a customer's currency is changed to dollars**

After a customer's currency is changed from euro to dollars, their existing invoices still display euros. The reporter is unsure whether this is wrong or intended, since finance may want old invoices to keep their original currency.

- Steps to reproduce: Change a customer's currency from euro to dollars
- Actual result: Old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should old invoices show after the customer's currency is changed to dollars?; [bug.environment] Which system, version, or environment was this observed in?; [general] Is it intended that old invoices keep their original currency, as finance may require, or is this a bug? If intended, should this be a Feature or a note instead?

Type check: not counted · latency 3880 ms · tokens 2369 in / 753 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · run 4

**Bug: Old invoices still show euro after customer currency is changed to dollars**

When a customer's currency is changed from euro to dollars, their existing invoices still show euros. The reporter is not sure whether this is a bug or intended behaviour, since finance may want old invoices to keep their original currency.

- Steps to reproduce: Change a customer's currency from euro to dollars | Open one of the customer's old invoices
- Actual result: Old invoices still show euros after the customer's currency is changed to dollars.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] Should old invoices show dollars after the currency change, or should they keep euros as they were issued?; [bug.environment] Which system, version, or environment was this seen in?; [general] Is this a bug, or is keeping old invoices in their original currency the intended behaviour? The report is unclear on this.

Type check: not counted · latency 3542 ms · tokens 2369 in / 673 out

- Facts present: __ of 3
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### AMBIGUOUS-01 · from audio

STT transcript (4411 ms):

> When I change a customer's currency from euro to dollars, their old invoices still show euros. I'm not sure if that's wrong or if it's meant to work like that, because maybe finance wants old invoices to stay as they are. But somebody should probably look at it.

Word error rate: 2,1% (1 substituted, 0 missing, 0 extra, of 48 words in the script)
Script path type (run 1): Bug

**Bug: Old invoices still show euros after changing a customer's currency to dollars**

After a customer's currency is changed from euro to dollars, their existing invoices still show euros. The speaker is unsure whether this is wrong or intended, since finance may want old invoices to keep their original currency.

- Steps to reproduce: Change a customer's currency from euro to dollars | Open the customer's existing invoices
- Actual result: Old invoices still show euros.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should the old invoices show after the currency change?; [bug.environment] Which system, version or environment is this happening in?; [general] Is this a bug or intended behaviour? The speaker mentioned finance may want old invoices to keep their original currency. If intended, this should be a Feature or a documentation request instead.

Type check: not counted · latency 3275 ms · tokens 2369 in / 643 out

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

When the invoice list is filtered by status Overdue, which shows twelve invoices, clicking Export CSV downloads a file that contains only the header row and no invoices. Exporting without the filter works correctly.

- Steps to reproduce: Open the invoice list | Filter by status Overdue, which shows twelve invoices | Click Export CSV
- Actual result: The file downloads but contains only the header row, with no invoices.
- Expected result: A file containing the twelve overdue invoices.
- Environment: Ledgerly version 3.8.2, Chrome 126, Windows 11

Missing information: none

Type check: match · latency 1559 ms · tokens 2428 in / 259 out

- Facts present: __ of 5
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### BUG-01 · from audio

STT transcript (7136 ms):

> Hi, I found a bug in the CSV export. I'm on ledgerly version 3.8.2 using Chrome 126 on Windows 11. I open the invoice list, filter by status overdue, which shows 12 invoices, and then click Export CSV. The file downloads, but it only contains the header row. No invoices at all. What I expect is a file with those 12 overdue invoices. If I export without the filter, it works fine.

Word error rate: 2,8% (2 substituted, 0 missing, 0 extra, of 72 words in the script)
Script path type (run 1): Bug

**Bug: CSV export contains only the header row when the invoice list is filtered by overdue status**

When the invoice list is filtered to overdue invoices (12 shown), Export CSV downloads a file that contains only the header row and no invoices. Exporting without the filter works correctly.

- Steps to reproduce: Open the invoice list | Filter by status overdue, which shows 12 invoices | Click Export CSV
- Actual result: The file downloads but contains only the header row, with no invoices.
- Expected result: A CSV file containing the 12 overdue invoices.
- Environment: ledgerly version 3.8.2, Chrome 126, Windows 11

Missing information: none

Type check: match · latency 2695 ms · tokens 2426 in / 565 out

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
- Actual result: The whole editor closes and all unsaved changes are lost. This happens every time.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should happen when Save is pressed with the due date cleared: should the invoice be saved without a due date, or should a validation message appear?; [bug.environment] Which browser, operating system, or app version were you using when this happened?; [general] Does the same happen when you clear other fields and press Save, or is it specific to the due date field?

Type check: match · latency 1920 ms · tokens 2352 in / 351 out

- Facts present: __ of 3
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### BUG-02 · from audio

STT transcript (4048 ms):

> There is a problem when saving invoices. If I open an existing invoice, clear the date field and press save, the whole editor just closes and all of my unsaved changes are gone. It happens every time I try it.

Word error rate: 10,3% (1 substituted, 1 missing, 2 extra, of 39 words in the script)
Script path type (run 1): Bug

**Bug: Editor closes and unsaved changes are lost when saving an invoice with a cleared date field**

When an existing invoice is opened, the date field is cleared and save is pressed, the whole editor closes and all unsaved changes are lost. The reporter says this happens every time.

- Steps to reproduce: Open an existing invoice | Clear the date field | Press save
- Actual result: The whole editor closes and all unsaved changes are lost.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.expectedResult] What should happen when save is pressed with the date field cleared, for example a validation message or the date being kept?; [bug.environment] Which browser, operating system, and application version were you using?; [general] Does the editor close for any other field left empty, or only for the date field?

Type check: match · latency 2334 ms · tokens 2351 in / 319 out

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

The revenue chart on the dashboard is broken and displays no data.

- Steps to reproduce: none
- Actual result: The revenue chart on the dashboard shows nothing.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.stepsToReproduce] What steps lead to the revenue chart showing nothing?; [bug.expectedResult] What should the revenue chart show instead?; [bug.environment] Which browser, operating system, or app version were you using?

Type check: match · latency 1484 ms · tokens 2313 in / 239 out

- Facts present: __ of 1
- Expected missing flagged: __ of 3 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### BUG-03 · from audio

STT transcript (3163 ms):

> The revenue chart on the dashboard is broken. It just shows nothing.

Word error rate: 0,0% (0 substituted, 0 missing, 0 extra, of 12 words in the script)
Script path type (run 1): Bug

**Bug: Revenue chart on dashboard shows nothing**

The revenue chart on the dashboard is broken and displays no data. Steps, environment and expected behaviour were not provided.

- Steps to reproduce: none
- Actual result: The revenue chart on the dashboard shows nothing.
- Expected result: Not provided
- Environment: Not provided

Missing information: [bug.stepsToReproduce] What steps lead to the revenue chart showing nothing?; [bug.expectedResult] What should the revenue chart show instead?; [bug.environment] Which browser, operating system or environment were you using when the chart showed nothing?

Type check: match · latency 1521 ms · tokens 2313 in / 265 out

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

Some customers receive the payment reminder email twice instead of once. The reminder should be sent once, three days before the due date. The issue occurs on production and started after the update last week.

- Steps to reproduce: Wait for the payment reminder to be sent to a customer before the due date
- Actual result: Some customers receive the payment reminder email twice. The reporter cannot see a pattern affecting which customers.
- Expected result: The reminder should go out once, three days before the due date.
- Environment: Production system. Started after the update last week.

Missing information: [bug.stepsToReproduce] What actions lead to the duplicate email, and is there a specific sequence that triggers it?; [bug.environment] What exact version or update was deployed last week, and which browser or client do affected customers use, if relevant?; [general] How many customers are affected, and can you share one example of an affected customer account or timestamp of both emails?

Type check: match · latency 3730 ms · tokens 2359 in / 366 out

- Facts present: __ of 5
- Expected missing flagged: __ of 1 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### BUG-04 · from audio

STT transcript (4646 ms):

> Some of our customers are getting the payment reminder emailed twice. Not all of them, just some. And I can't see a pattern. The reminder should go out once, three days before the due date. This is on the production system and it started after the update last week.

Word error rate: 2,0% (1 substituted, 0 missing, 0 extra, of 49 words in the script)
Script path type (run 1): Bug

**Attempts: 2** (the first attempt was not usable).

**Bug: Some customers receive the payment reminder email twice**

Some customers are receiving the payment reminder email twice, though not all of them and no clear pattern is visible. The reminder should be sent once, three days before the due date. This is happening on production and started after the update last week.

- Steps to reproduce: Wait for the payment reminder to be sent to customers three days before the due date
- Actual result: Some customers receive the payment reminder email twice. No pattern has been identified.
- Expected result: The payment reminder is sent once, three days before the due date.
- Environment: Production system, started after the update last week

Missing information: [bug.stepsToReproduce] What actions trigger the reminder email, and what steps lead to a customer receiving it twice?; [bug.environment] Which update last week is meant, and what version or build is production running now?; [general] Is there a specific customer or set of customers affected whose account data could be checked for the duplicate sends?

Type check: match · latency 5682 ms · tokens 4720 in / 668 out

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

Accountants currently mark invoices as paid one by one after each bank import, which is slow. Add a bulk action in the invoice list: selecting one or more invoices via checkboxes shows a Mark as paid button, which opens a confirmation dialog showing the number of invoices to be changed, with the paid date defaulting to today and already paid invoices skipped.

- User need: Accountants need to mark many invoices as paid at once after each bank import instead of one by one, because the current process takes too long.
- Proposed behavior: In the invoice list, each invoice has a checkbox so several can be selected. When at least one invoice is selected, a Mark as paid button appears. Clicking it opens a confirmation dialog showing how many invoices will be changed. The paid date defaults to today. Invoices that are already paid are skipped and not changed.
- Acceptance criteria: The invoice list shows a checkbox for each invoice that can be selected. | The Mark as paid button appears when at least one invoice is selected. | Clicking Mark as paid opens a confirmation dialog that shows how many invoices will be changed. | The paid date is set to today's date by default. | Invoices that are already paid are not changed when the bulk action is confirmed.

Missing information: [feature.userNeed] Is the accountant role the only user group that needs this, or should other roles have access as well?; [feature.proposedBehavior] Should the paid date be editable in the confirmation dialog, or is today's date always used?; [general] Should the bulk action also be available from other screens, or only from the invoice list?

Type check: match · latency 3616 ms · tokens 2448 in / 586 out

- Facts present: __ of 6
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### FEATURE-01 · from audio

STT transcript (8133 ms):

> I'd like to request a bulk action for marking invoices as paid. Right now, our accountants mark them one by one after every bank import, and it takes ages. Here's what I would want. In the invoice list, there are checkboxes, so you can select several invoices. As soon as at least one is selected, a button called Mark as paid appears. Clicking it opens a confirmation dialog that shows how many invoices will be changed. The paid date is set to today by default and invoices that are already paid are skipped, not changed.

Word error rate: 2,1% (1 substituted, 0 missing, 1 extra, of 94 words in the script)
Script path type (run 1): Feature

**Feature: Bulk action to mark selected invoices as paid from the invoice list**

Accountants currently mark invoices as paid one by one after every bank import, which takes a long time. The invoice list should let users select several invoices with checkboxes and mark them all as paid in one action, with a confirmation dialog, a default paid date of today, and already paid invoices skipped.

- User need: Accountants mark invoices as paid one by one after every bank import, and it takes ages.
- Proposed behavior: In the invoice list, add checkboxes to select several invoices. When at least one invoice is selected, show a button called Mark as paid. Clicking it opens a confirmation dialog that shows how many invoices will be changed. The paid date is set to today by default, and invoices that are already paid are skipped and not changed.
- Acceptance criteria: The invoice list shows a checkbox for each invoice that lets the user select several invoices. | A button called Mark as paid appears when at least one invoice is selected. | Clicking Mark as paid opens a confirmation dialog that shows how many invoices will be changed. | The paid date of the selected invoices is set to today by default. | Invoices that are already paid are skipped and their data is not changed.

Missing information: [feature.proposedBehavior] Should the paid date be editable in the confirmation dialog, or is it always today?

Type check: match · latency 4691 ms · tokens 2448 in / 975 out

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

**Feature: Add dark mode toggle to Ledgerly user menu with remembered preference**

Users who work late find the white screen hard on the eyes. Add a switch in the user menu to turn dark mode on and off, and have the app remember the choice at the next login.

- User need: Users who work late in the evening find the white screen hard on the eyes and want a dark mode.
- Proposed behavior: A switch in the user menu turns dark mode on and off. The app remembers the choice the next time the user logs in.
- Acceptance criteria: A switch in the user menu turns dark mode on. | The same switch turns dark mode off. | The chosen dark mode setting is still applied the next time the user logs in.

Missing information: [feature.acceptanceCriteria] Should dark mode apply to every screen in the app, or only some screens?; [feature.userNeed] Is the preference meant to be saved per user account or per device or browser?

Type check: match · latency 2103 ms · tokens 2373 in / 349 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### FEATURE-02 · from audio

STT transcript (4497 ms):

> Feature idea. A dark mode for leisurely. A lot of us work late in the evening and the white screen is hard on the eyes. I think there should be a switch in the user menu to turn dark mode on and off, and the app should remember my choice the next time I log in.

Word error rate: 1,8% (1 substituted, 0 missing, 0 extra, of 56 words in the script)
Script path type (run 1): Feature

**Feature: Add dark mode switch in user menu that persists across logins**

Users who work late in the evening find the white screen hard on the eyes. Add a switch in the user menu to turn dark mode on and off, and remember the choice for the next login.

- User need: A lot of people work late in the evening and find the white screen hard on the eyes.
- Proposed behavior: A switch in the user menu turns dark mode on and off. The app remembers the choice the next time the user logs in.
- Acceptance criteria: A dark mode switch is available in the user menu. | Turning the switch on shows the app in dark mode. | Turning the switch off shows the app in the normal light mode. | The selected mode is still applied the next time the user logs in.

Missing information: [title] Is 'leisurely' the correct name of the product? The title was transcribed as 'for leisurely'.; [feature.userNeed] Is there a specific group of users beyond those who work late in the evening who need this?

Type check: match · latency 2106 ms · tokens 2371 in / 361 out

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

Missing information: [feature.userNeed] Which customers asked for this, and what specific branding do they want on invoices?; [feature.proposedBehavior] What should customers be able to customize on invoices, such as logo, colours, fonts or layout?; [feature.acceptanceCriteria] What would show that the feature works, for example which invoice elements can be changed and where?; [title] Is the title right, or should it name a specific customization option?; [description] Is there any further detail on the scope of the investigation the speaker wants?

Type check: match · latency 2469 ms · tokens 2353 in / 354 out
- **Trap hit:** `font` in missingInformation (only in questions)

- Facts present: __ of 3
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### FEATURE-03 · from audio

STT transcript (4220 ms):

> So, our customers keep asking whether we could make their invoices more customizable. They want them to feel like their own brand, you know? I'm not sure exactly what that should look like, but it would be good to look into it.

Word error rate: 4,7% (1 substituted, 1 missing, 0 extra, of 43 words in the script)
Script path type (run 1): Feature

**Feature: Allow customers to customize invoice branding**

Customers have asked for more customizable invoices so they feel like their own brand. The speaker is unsure what the customization should look like and wants it investigated.

- User need: Customers want their invoices to feel like their own brand.
- Proposed behavior: Not provided
- Acceptance criteria: none

Missing information: [feature.userNeed] Which customers asked for this, and what specific branding do they want to control on invoices?; [feature.proposedBehavior] What should customers be able to customize on invoices, such as logo, colors, fonts, or layout?; [feature.acceptanceCriteria] What would show the feature works, for example a customer can upload a logo that appears on generated invoices?; [general] The speaker said they are unsure what this should look like and want it looked into. Should this ticket be a discovery or research task first instead of a build task?

Type check: match · latency 2091 ms · tokens 2352 in / 353 out
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

**Bug: Invoice PDF omits the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is cut off in the downloaded PDF. A test invoice with twenty-five items produced a PDF missing the twenty-fifth item. All items should appear in the PDF.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice PDF
- Actual result: The last line item (the twenty-fifth) is missing from the PDF.
- Expected result: All line items appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system, or app version were you using when the PDF was downloaded?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket for it?

Type check: not counted · latency 4527 ms · tokens 2423 in / 720 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 2

**Bug: Invoice PDF cuts off the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. With an invoice of twenty-five items, the twenty-fifth item did not appear in the PDF.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice PDF
- Actual result: The last line item, the twenty-fifth, is cut off and missing from the PDF.
- Expected result: All line items should appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system or app version were you using when you downloaded the PDF?; [bug.stepsToReproduce] Does the cut-off also happen with exactly twenty-one line items?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket for it?

Type check: not counted · latency 5117 ms · tokens 2423 in / 1121 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 3

**Bug: Invoice PDF cuts off the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. With an invoice of twenty-five items, the twenty-fifth item was absent.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice PDF
- Actual result: The twenty-fifth (last) line item is missing from the PDF.
- Expected result: All line items are included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] Which browser, operating system or app version were you using?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket?

Type check: not counted · latency 3975 ms · tokens 2423 in / 773 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · run 4

**Bug: Invoice PDF cuts off the last line item when an invoice has more than twenty items**

When an invoice has more than twenty line items, the last line item is missing from the downloaded PDF. The reporter made an invoice with twenty-five items and the twenty-fifth was absent.

- Steps to reproduce: Create an invoice with twenty-five line items | Download the invoice as a PDF
- Actual result: The twenty-fifth (last) line item is missing from the PDF.
- Expected result: All line items should be included in the PDF.
- Environment: Not provided

Missing information: [bug.environment] What browser, operating system or app version were you using?; [general] A second request was mentioned: a custom footer note on invoices, such as a thank-you message or bank details. Create a separate ticket for it?

Type check: not counted · latency 4304 ms · tokens 2423 in / 821 out

- Facts present: __ of 4
- Expected missing flagged: __ of 2 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### MIXED-01 · from audio

STT transcript (7460 ms):

> Two things about the invoice PDF. First, there is a bug. When an invoice has more than 20 line items, the last line item is cut off in the PDF. I made one with 25 items, downloaded the PDF, and the 25th item was missing. All items should be in there, of course. Second, and this is more of a wish, it would be nice to have a custom footer note on invoices, like a thank you message or bank details.

Word error rate: 8,5% (4 substituted, 2 missing, 1 extra, of 82 words in the script)
Script path type (run 1): Bug

**Bug: Invoice PDF cuts off the last line item when an invoice has more than 20 items**

When an invoice has more than 20 line items, the last line item is missing from the downloaded PDF. The reporter made an invoice with 25 items and the 25th item did not appear. All items should be included.

- Steps to reproduce: Create an invoice with 25 line items | Download the invoice PDF
- Actual result: The last line item (the 25th) is missing from the PDF.
- Expected result: All line items should appear in the PDF.
- Environment: Not provided

Missing information: [bug.environment] What browser, operating system, and app or invoice tool version were you using when you downloaded the PDF?; [general] A second item was mentioned: a custom footer note on invoices, such as a thank you message or bank details. Create a separate ticket for it?

Type check: not counted · latency 4244 ms · tokens 2416 in / 888 out

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

**Bug: Invoice list search returns no results for full invoice number INV-0042**

In Ledgerly 3.9 using Firefox, searching the invoice list for the full invoice number INV-0042 returns no results. Searching by customer name works correctly.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing for INV-0042.
- Expected result: The search shows the invoice INV-0042.
- Environment: Ledgerly 3.9, Firefox

Missing information: [bug.environment] What is the Firefox version and the operating system?

Type check: not counted · latency 3774 ms · tokens 2489 in / 747 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 2

**Bug: Invoice search by full invoice number INV-0042 returns no results**

In Ledgerly 3.9 using Firefox, searching the invoice list for the full invoice number INV-0042 returns no results, although searching by customer name works. The reporter expects the invoice to be shown.

- Steps to reproduce: Type the full invoice number INV-0042 into the search box on the invoice list
- Actual result: The search finds nothing.
- Expected result: The invoice INV-0042 is shown.
- Environment: Ledgerly 3.9, Firefox

Missing information: [bug.environment] What operating system and Firefox version were you using?; [bug.stepsToReproduce] Did you open the invoice list before typing the invoice number, and did you press Enter or wait for the search to run?

Type check: not counted · latency 4146 ms · tokens 2489 in / 851 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 3

**Bug: Invoice list search finds nothing for full invoice number INV-0042**

Searching the invoice list for the full invoice number INV-0042 returns no results, although searching by customer name works. The reporter expected the search to show that invoice.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 in the search box
- Actual result: The search finds nothing for INV-0042. Searching by customer name works.
- Expected result: The invoice INV-0042 is shown in the results.
- Environment: Ledgerly 3.9 in Firefox. Firefox version and operating system not stated.

Missing information: [bug.environment] What is the Firefox version and the operating system?; [bug.stepsToReproduce] Does this happen every time you search for an invoice number, or only for INV-0042?

Type check: not counted · latency 4947 ms · tokens 2489 in / 914 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · run 4

**Bug: Invoice list search returns nothing for full invoice number INV-0042 in Ledgerly 3.9 on Firefox**

In the invoice list search box, searching for the full invoice number INV-0042 returns no results. Searching by the customer's name works. The reporter expected the search to show that invoice.

- Steps to reproduce: Open the invoice list | Type the full invoice number INV-0042 into the search box
- Actual result: The search finds nothing for INV-0042.
- Expected result: The invoice INV-0042 is shown in the results.
- Environment: Ledgerly 3.9, Firefox (browser version and operating system not stated)

Missing information: [bug.stepsToReproduce] Did you press Enter or another key to run the search, or does the search run as you type?; [bug.environment] Which Firefox version and which operating system were you using?

Type check: not counted · latency 4375 ms · tokens 2489 in / 905 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 

#### NOISY-01 · from audio

STT transcript (11544 ms):

> Okay, so, um, I was working on On Tuesday No, no, wait Wednesday, it was Wednesday and I tried to find an invoice You know the way I always do in the search box on the invoice list. And I typed the full invoice number like INB-0042. And it found nothing, like nothing, which is weird because if I search by customer's name, it works completely fine. This is in ledgerly 3.8. Oh, no, sorry, 3.9. Yes. And I'm using Firefox. Anyway, I will expect it to just show that invoice. Yeah. Sorry, that was a bit long.

Word error rate: 10,3% (2 substituted, 3 missing, 5 extra, of 97 words in the script)
Script path type (run 1): Bug

**Bug: Invoice list search finds no results for full invoice number INB-0042 in Ledgerly 3.9**

Searching the invoice list for the full invoice number INB-0042 returns nothing in Ledgerly 3.9 on Firefox. Searching by customer name in the same search box works correctly.

- Steps to reproduce: Open the invoice list in Ledgerly 3.9 | Type the full invoice number INB-0042 into the search box
- Actual result: The search finds nothing for invoice number INB-0042.
- Expected result: The search shows invoice INB-0042.
- Environment: Ledgerly 3.9, Firefox (version not stated)

Missing information: [bug.environment] Which operating system and Firefox version were you using?

Type check: not counted · latency 4936 ms · tokens 2481 in / 835 out

- Facts present: __ of 4
- Expected missing flagged: __ of 0 · spurious missing items: __
- Invention (none / minor / critical, with text): 
- Usability (usable / minor edit / rewrite): 
