/**
 * Edad en años a partir de una fecha "AAAA-MM-DD" (como la guarda el
 * backend). null si falta, es inválida o está en el futuro.
 */
export function ageLabel(dateOfBirth: string | null | undefined, today = new Date()): string | null {
  if (!dateOfBirth) {
    return null;
  }
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
    age -= 1;
  }
  if (age < 0) {
    return null;
  }
  return age === 1 ? "1 año" : `${age} años`;
}
