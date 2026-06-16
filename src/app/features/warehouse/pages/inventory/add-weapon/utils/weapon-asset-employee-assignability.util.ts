import { EmployeeDto } from '@models/employee.model';

/** Backend expects assignable employees with a resolvable department. */
export function employeeCannotAssignById(
  employeeId: number | null | undefined,
  employees: EmployeeDto[]
): boolean {
  if (employeeId == null || employeeId <= 0) return false;
  const emp = employees.find((e) => e.id === employeeId);
  if (!emp) return true;
  const hasDept =
    (emp.departmentId != null && emp.departmentId > 0) ||
    (emp.department?.id != null && emp.department.id > 0);
  return !hasDept;
}
