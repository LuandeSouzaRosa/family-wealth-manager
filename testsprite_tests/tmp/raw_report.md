
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** family_wealth_manager
- **Date:** 2026-03-11
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Dashboard shows core metric cards for a selected month/year
- **Test Code:** [TC001_Dashboard_shows_core_metric_cards_for_a_selected_monthyear.py](./TC001_Dashboard_shows_core_metric_cards_for_a_selected_monthyear.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- ModuleNotFoundError 'No module named 'cgi'' displayed on the page, preventing the Streamlit application from running.
- Dashboard page did not load because the application terminated with an exception during startup.
- Month and year dropdown controls are not present on the page due to the application error.
- Texts 'Total Income', 'Total Expense', and 'Balance' are not visible because the dashboard failed to render.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/76c4c279-82c0-42fc-a52a-c5f10c499074
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Dashboard shows 50/30/20 breakdown after selecting a month/year
- **Test Code:** [TC002_Dashboard_shows_503020_breakdown_after_selecting_a_monthyear.py](./TC002_Dashboard_shows_503020_breakdown_after_selecting_a_monthyear.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- ModuleNotFoundError: No module named 'cgi' is displayed inside the Streamlit app iframe, preventing the main UI from loading.
- Month dropdown not found on the page.
- Year dropdown not found on the page.
- Texts '50/30/20', 'Needs', 'Wants', and 'Savings' are not present on the page.
- Login attempt did not lead to the main application UI; the login form or traceback remains visible instead of the budget interface.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/dd283c1f-4207-48c3-8842-77a769978bc9
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Dashboard shows financial score and qualitative health label for selected month/year
- **Test Code:** [TC003_Dashboard_shows_financial_score_and_qualitative_health_label_for_selected_monthyear.py](./TC003_Dashboard_shows_financial_score_and_qualitative_health_label_for_selected_monthyear.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Application crashed during startup and displays a Python traceback containing "ModuleNotFoundError: No module named 'cgi'" on the page.
- Login flow could not proceed because the Streamlit app failed to render the authenticated UI and instead shows the traceback.
- Month and year dropdowns are not present on the page; the Financial Score UI elements were not rendered.
- No interactive elements required to select a period or view the financial score are available due to the startup error.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/f3d596b1-419d-418a-a726-b448c9642297
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Add an expense transaction with Essential category and verify it appears in the list
- **Test Code:** [TC007_Add_an_expense_transaction_with_Essential_category_and_verify_it_appears_in_the_list.py](./TC007_Add_an_expense_transaction_with_Essential_category_and_verify_it_appears_in_the_list.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login form not found on /login: no username or password input fields visible.
- Login failed - cannot enter credentials because input fields are missing.
- Unable to access authenticated features (sidebar / 'Add Transaction') because authentication cannot be performed.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/5b5f39e7-2c97-4035-965c-03ed53dba040
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Validation: attempt to save without date shows 'Date required' and remains on form
- **Test Code:** [TC009_Validation_attempt_to_save_without_date_shows_Date_required_and_remains_on_form.py](./TC009_Validation_attempt_to_save_without_date_shows_Date_required_and_remains_on_form.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Application crashed with 'ModuleNotFoundError: No module named 'cgi'' displayed on the /login page, preventing UI interaction.
- Login and dashboard UI are not reachable because the stack trace is shown instead of the app interface.
- The 'Add Transaction' form could not be opened, so date-field validation could not be tested.
- Typed credentials and clicked the login button did not produce a redirect or functional UI; the stack trace persisted.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/4eea5d6a-0d61-4ff3-a9a1-07cbe61b19bd
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Validation: attempt to save without amount shows an amount-required error
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/4e4e4fb5-ad59-426e-8f17-f2211d834978
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 Add a durable asset with a positive value updates list and total patrimony
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/db00fc58-3732-4759-bfc5-1f8bf4a1d394
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014 Save a new asset and confirm it appears in the patrimony list
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/75345b3b-6d58-4bdc-b8e5-7f1dd699c620
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017 Negative asset value shows validation error and does not save
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/79b00060-9cfd-423c-9d12-f3ed340911b8
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC019 Negative end-of-month projection shows 'At risk' alert and mitigation suggestions
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/6924ecf4-1211-47c4-9b79-8569b26ed8e6
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC020 Positive or non-negative projection does not show 'At risk' alert
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/f647a566-857e-4c04-bafe-15e9feca8837
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC021 Category exceeds 80% threshold shows a budget alert for that category
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/41c235e7-d5ba-4d3e-bc6d-4589cca81ce8
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC022 Category reaches or exceeds 100% shows a critical budget alert
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/69c04f0a-abe9-43c5-9c67-441de0226126
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC023 Clicking a budget alert shows contributing transactions for the alerted category
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/cdeb25a8-bd3d-4604-9a7e-a26d15b6e050
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Dashboard shows autonomy months metric for selected month/year
- **Test Code:** [null](./null)
- **Test Error:** Test execution failed or timed out
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d063a671-1372-4625-a72b-89178ffa81e0/4ab4cf5c-f921-4f0f-bf0d-54ec5b8ef15f
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **0.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---