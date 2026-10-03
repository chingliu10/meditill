# Future HR / Payroll

Authentication users and employees are separate concepts.

Future tables:
employees, departments, positions, employee_branches, shifts, attendance, leave_requests, payroll_periods, payroll_runs, payroll_items.

employees.user_id is nullable because many employees do not need application access. Payroll can later post to Accounting without changing the pharmacy core.
