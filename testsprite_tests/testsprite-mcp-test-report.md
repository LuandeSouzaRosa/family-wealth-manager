# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** family_wealth_manager
- **Date:** 2026-03-13
- **Prepared by:** Trae AI & TestSprite

---

## 2️⃣ Requirement Validation Summary

### Dashboard & Core Navigation
| Test ID | Description | Status | Findings |
|:---:|:---|:---:|:---|
| TC001 | View dashboard overview KPIs | ✅ Passed | Dashboard KPIs (Balance, Income, Expenses) load correctly. |
| TC003 | Dashboard shows breakdown | ✅ Passed | Visualizations are rendering. |
| TC004 | Dashboard shows total balance | ✅ Passed | Total balance card is accurate. |
| TC007 | Invalid login protection | ✅ Passed | Security is functioning (redirects to login). |

### Transactions
| Test ID | Description | Status | Findings |
|:---:|:---|:---:|:---|
| TC008 | Create expense transaction | ✅ Passed | Expense creation works perfectly. |
| TC009 | Create income transaction | ✅ Passed | Income creation works perfectly. |
| TC010 | Field validation | ✅ Passed | Required fields are validated correctly. |
| TC011 | Delete transaction | ✅ Passed | Deletion works correctly. |

### Recurring Expenses (RLS Issue Detected)
| Test ID | Description | Status | Findings |
|:---:|:---|:---:|:---|
| TC014 | Add recurring expense | ❌ Failed | **CRITICAL:** "new row violates row-level security policy for table recorrentes". The test user (luan.teste) cannot insert into this table. |
| TC015 | Complete recurring form | ✅ Passed | Form interaction works, but save might be flaky depending on previous state. |
| TC016 | Invalid amount validation | ✅ Passed | Validation works. |
| TC017 | Correct invalid amount | ✅ Passed | Correction works. |

### Budgets (RLS Issue Detected)
| Test ID | Description | Status | Findings |
|:---:|:---|:---:|:---|
| TC018 | Create budget limit | ❌ Failed | **CRITICAL:** "new row violates row-level security policy for table orcamentos". Same RLS error as recurring expenses. |
| TC019 | Validate budget amount | ❌ Failed | Blocked by RLS error. |
| TC023 | Delete budget | ❌ Failed | Blocked because budget couldn't be created (RLS). |

---

## 3️⃣ Coverage & Matching Metrics

- **Total Tests:** 15
- **Passed:** 11 (73.33%)
- **Failed:** 4 (26.67%)

---

## 4️⃣ Key Gaps / Risks

1.  **Row Level Security (RLS) Blocking Writes:**
    *   The tests for **Recurring Expenses** and **Budgets** failed with an explicit RLS violation error: `new row violates row-level security policy`.
    *   **Root Cause:** The `security_final_cleanup.sql` or `couple_view` scripts might have tightened permissions too much or the test user `luan.teste@test.com` doesn't have a profile/family created correctly in the test environment database state.
    *   **Impact:** Real users might face this if their profile/family link isn't set up correctly.

2.  **Transaction Feature is Solid:**
    *   Unlike the other two modules, Transactions (Entradas/Saídas) passed all tests, meaning the basic RLS for `transacoes` is working fine. The issue is specific to `recorrentes` and `orcamentos`.

3.  **Action Plan:**
    *   We need to review the RLS policies for `recorrentes` and `orcamentos` in the SQL scripts to ensure they match the logic used for `transacoes` (allowing INSERTs for authenticated users).
