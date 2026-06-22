export function validateField(value: string, type: string): boolean {
  const v = value.trim();
  switch (type) {
    case "cnpj": {
      const d = v.replace(/\D/g, "");
      if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
      const calc = (weights: number[]) =>
        weights.reduce((sum, w, i) => sum + Number(d[i]) * w, 0) % 11;
      const r1 = calc([5,4,3,2,9,8,7,6,5,4,3,2]);
      if (Number(d[12]) !== (r1 < 2 ? 0 : 11 - r1)) return false;
      const r2 = calc([6,5,4,3,2,9,8,7,6,5,4,3,2]);
      return Number(d[13]) === (r2 < 2 ? 0 : 11 - r2);
    }
    case "cep":
      return /^\d{8}$/.test(v.replace(/\D/g, ""));
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    case "phone":
      return /^\d{10,11}$/.test(v.replace(/\D/g, ""));
    case "number":
      return !isNaN(Number(v)) && v !== "";
    default:
      return true;
  }
}
