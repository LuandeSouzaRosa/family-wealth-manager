
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** family_wealth_manager
- **Date:** 2026-03-13
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 View dashboard overview KPIs and recent transactions
- **Test Code:** [TC001_View_dashboard_overview_KPIs_and_recent_transactions.py](./TC001_View_dashboard_overview_KPIs_and_recent_transactions.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/1073bc76-c466-485c-9c4f-7a7745f9e005
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Dashboard shows income and expense breakdown section
- **Test Code:** [TC003_Dashboard_shows_income_and_expense_breakdown_section.py](./TC003_Dashboard_shows_income_and_expense_breakdown_section.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/c23b9f5c-4b54-43ea-9b34-cd7b099228d3
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Dashboard shows total balance card
- **Test Code:** [TC004_Dashboard_shows_total_balance_card.py](./TC004_Dashboard_shows_total_balance_card.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/528c4bf4-1460-4f79-8fe6-7c44233fef7f
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Invalid login prevents reaching dashboard
- **Test Code:** [TC007_Invalid_login_prevents_reaching_dashboard.py](./TC007_Invalid_login_prevents_reaching_dashboard.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/cd9af802-473d-4587-aa29-c6aa8f1ec5ac
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Create an expense transaction and verify it appears in the transactions list
- **Test Code:** [TC008_Create_an_expense_transaction_and_verify_it_appears_in_the_transactions_list.py](./TC008_Create_an_expense_transaction_and_verify_it_appears_in_the_transactions_list.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/96df1073-5e90-4ed2-afd8-aeae33cb7eda
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Create an income transaction and verify it appears in the transactions list
- **Test Code:** [TC009_Create_an_income_transaction_and_verify_it_appears_in_the_transactions_list.py](./TC009_Create_an_income_transaction_and_verify_it_appears_in_the_transactions_list.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/38400ede-98cb-496f-a591-3001037f6392
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Required field validation blocks submission then allows successful submit after fixing
- **Test Code:** [TC010_Required_field_validation_blocks_submission_then_allows_successful_submit_after_fixing.py](./TC010_Required_field_validation_blocks_submission_then_allows_successful_submit_after_fixing.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Validation message 'obrigatório' not displayed after submitting the transaction form with the Valor field empty.
- Required-field validation did not block saving: transaction was saved after entering Valor and appears in the transactions list.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/4eca55c1-c08d-47a3-9184-0f9d5768fc15
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 Delete a transaction and verify it is removed from the list
- **Test Code:** [TC011_Delete_a_transaction_and_verify_it_is_removed_from_the_list.py](./TC011_Delete_a_transaction_and_verify_it_is_removed_from_the_list.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/59f951aa-cd77-4d73-91b9-a89c20bf3c18
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014 Add a new recurring expense and verify it appears in the list
- **Test Code:** [TC014_Add_a_new_recurring_expense_and_verify_it_appears_in_the_list.py](./TC014_Add_a_new_recurring_expense_and_verify_it_appears_in_the_list.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/3c31e051-7832-49a3-bc14-79c29745cdcd
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 Complete recurring expense creation form and save successfully
- **Test Code:** [TC015_Complete_recurring_expense_creation_form_and_save_successfully.py](./TC015_Complete_recurring_expense_creation_form_and_save_successfully.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/7922d5f3-696c-420c-ac22-470f3215b573
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC016 Attempt to save with invalid amount and verify validation error appears
- **Test Code:** [TC016_Attempt_to_save_with_invalid_amount_and_verify_validation_error_appears.py](./TC016_Attempt_to_save_with_invalid_amount_and_verify_validation_error_appears.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/74816e65-ba9a-419a-97e3-a4adf93f56ce
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017 Correct invalid amount and save successfully after validation error
- **Test Code:** [TC017_Correct_invalid_amount_and_save_successfully_after_validation_error.py](./TC017_Correct_invalid_amount_and_save_successfully_after_validation_error.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/9058f583-dbf8-4dd8-b096-7cfd9454f7ae
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC018 Create a new budget limit and verify it appears with a progress bar
- **Test Code:** [TC018_Create_a_new_budget_limit_and_verify_it_appears_with_a_progress_bar.py](./TC018_Create_a_new_budget_limit_and_verify_it_appears_with_a_progress_bar.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/23373dad-3b47-4a80-9be6-199a9a425ca6
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC019 Validate required amount when creating a budget limit
- **Test Code:** [TC019_Validate_required_amount_when_creating_a_budget_limit.py](./TC019_Validate_required_amount_when_creating_a_budget_limit.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Validation error 'O valor deve ser um número positivo.' displayed after attempting to save without a valid amount.
- Budget save did not complete after entering amount 300; no budget entry with amount 300 is present in the budgets list.
- Modal remained open and displayed 'Já existe um orçamento definido para esta categoria.', indicating the selected category already has a budget and prevented saving.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/5feb4149-4395-4ebf-b564-6311da40be43
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC023 Delete a budget and confirm it is removed from the list
- **Test Code:** [TC023_Delete_a_budget_and_confirm_it_is_removed_from_the_list.py](./TC023_Delete_a_budget_and_confirm_it_is_removed_from_the_list.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - authentication did not complete after two attempts and the login form remained visible.
- Submit button became unresponsive or produced a stale element error preventing navigation to authenticated pages.
- Budgets page could not be reached because authentication did not succeed; create/delete budget flow could not be tested.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/eb958579-1887-47c6-bf7b-80023e97bd76/62858bbe-2d72-4af5-9578-473c150699be
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **80.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---