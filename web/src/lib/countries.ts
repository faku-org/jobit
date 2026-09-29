/**
 * Los países para el selector de teléfono. La bandera se arma del código ISO
 * con los "regional indicators" de Unicode, así que no hace falta guardar ni
 * bajar ninguna imagen.
 */
export interface Country {
  iso: string;
  name: string;
  dial: string;
}

export const COUNTRIES: Country[] = [
  { iso: "UY", name: "Uruguay", dial: "598" },
  { iso: "AR", name: "Argentina", dial: "54" },
  { iso: "BO", name: "Bolivia", dial: "591" },
  { iso: "BR", name: "Brasil", dial: "55" },
  { iso: "CL", name: "Chile", dial: "56" },
  { iso: "CO", name: "Colombia", dial: "57" },
  { iso: "CR", name: "Costa Rica", dial: "506" },
  { iso: "CU", name: "Cuba", dial: "53" },
  { iso: "DO", name: "República Dominicana", dial: "1809" },
  { iso: "EC", name: "Ecuador", dial: "593" },
  { iso: "SV", name: "El Salvador", dial: "503" },
  { iso: "GT", name: "Guatemala", dial: "502" },
  { iso: "HN", name: "Honduras", dial: "504" },
  { iso: "MX", name: "México", dial: "52" },
  { iso: "NI", name: "Nicaragua", dial: "505" },
  { iso: "PA", name: "Panamá", dial: "507" },
  { iso: "PY", name: "Paraguay", dial: "595" },
  { iso: "PE", name: "Perú", dial: "51" },
  { iso: "PR", name: "Puerto Rico", dial: "1787" },
  { iso: "VE", name: "Venezuela", dial: "58" },
  { iso: "US", name: "Estados Unidos", dial: "1" },
  { iso: "CA", name: "Canadá", dial: "1" },
  { iso: "ES", name: "España", dial: "34" },
  { iso: "PT", name: "Portugal", dial: "351" },
  { iso: "IT", name: "Italia", dial: "39" },
  { iso: "FR", name: "Francia", dial: "33" },
  { iso: "DE", name: "Alemania", dial: "49" },
  { iso: "GB", name: "Reino Unido", dial: "44" },
  { iso: "IE", name: "Irlanda", dial: "353" },
  { iso: "NL", name: "Países Bajos", dial: "31" },
  { iso: "BE", name: "Bélgica", dial: "32" },
  { iso: "CH", name: "Suiza", dial: "41" },
  { iso: "AT", name: "Austria", dial: "43" },
  { iso: "SE", name: "Suecia", dial: "46" },
  { iso: "NO", name: "Noruega", dial: "47" },
  { iso: "DK", name: "Dinamarca", dial: "45" },
  { iso: "FI", name: "Finlandia", dial: "358" },
  { iso: "PL", name: "Polonia", dial: "48" },
  { iso: "RU", name: "Rusia", dial: "7" },
  { iso: "UA", name: "Ucrania", dial: "380" },
  { iso: "RO", name: "Rumania", dial: "40" },
  { iso: "GR", name: "Grecia", dial: "30" },
  { iso: "TR", name: "Turquía", dial: "90" },
  { iso: "IL", name: "Israel", dial: "972" },
  { iso: "IN", name: "India", dial: "91" },
  { iso: "CN", name: "China", dial: "86" },
  { iso: "JP", name: "Japón", dial: "81" },
  { iso: "KR", name: "Corea del Sur", dial: "82" },
  { iso: "AU", name: "Australia", dial: "61" },
  { iso: "NZ", name: "Nueva Zelanda", dial: "64" },
  { iso: "ZA", name: "Sudáfrica", dial: "27" },
  { iso: "EG", name: "Egipto", dial: "20" },
  { iso: "MA", name: "Marruecos", dial: "212" },
  { iso: "NG", name: "Nigeria", dial: "234" },
  { iso: "KE", name: "Kenia", dial: "254" },
  { iso: "DZ", name: "Argelia", dial: "213" },
  { iso: "TN", name: "Túnez", dial: "216" },
  { iso: "AO", name: "Angola", dial: "244" },
  { iso: "MZ", name: "Mozambique", dial: "258" },
  { iso: "CV", name: "Cabo Verde", dial: "238" },
  { iso: "GW", name: "Guinea-Bisáu", dial: "245" },
  { iso: "PH", name: "Filipinas", dial: "63" },
  { iso: "ID", name: "Indonesia", dial: "62" },
  { iso: "TH", name: "Tailandia", dial: "66" },
  { iso: "VN", name: "Vietnam", dial: "84" },
  { iso: "MY", name: "Malasia", dial: "60" },
  { iso: "SG", name: "Singapur", dial: "65" },
  { iso: "AE", name: "Emiratos Árabes Unidos", dial: "971" },
  { iso: "SA", name: "Arabia Saudita", dial: "966" },
  { iso: "QA", name: "Catar", dial: "974" },
  { iso: "KW", name: "Kuwait", dial: "965" },
  { iso: "OM", name: "Omán", dial: "968" },
  { iso: "JO", name: "Jordania", dial: "962" },
  { iso: "LB", name: "Líbano", dial: "961" },
  { iso: "IQ", name: "Irak", dial: "964" },
  { iso: "PK", name: "Pakistán", dial: "92" },
  { iso: "BD", name: "Bangladés", dial: "880" },
  { iso: "LK", name: "Sri Lanka", dial: "94" },
  { iso: "NP", name: "Nepal", dial: "977" },
];

const byIso = new Map(COUNTRIES.map((country) => [country.iso, country]));

export const countryByIso = (iso: string): Country | undefined => byIso.get(iso.toUpperCase());

export const DEFAULT_COUNTRY_ISO = "UY";

/** "UY" -> "🇺🇾" con los regional indicators. Si la plataforma no dibuja la
 * bandera, se ven las dos letras, que igual dice qué país es. */
export function flagOf(iso: string): string {
  const code = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + (letter.charCodeAt(0) - 65)));
}

/** El `+598 99 123 456` se parte en país y número para volver a editarlo. */
export function splitPhone(
  phone: string,
  countryIso: string,
): { iso: string; national: string } {
  const trimmed = phone.trim();
  const country = countryByIso(countryIso);

  if (!trimmed) return { iso: country?.iso ?? DEFAULT_COUNTRY_ISO, national: "" };
  if (!trimmed.startsWith("+")) return { iso: country?.iso ?? DEFAULT_COUNTRY_ISO, national: trimmed };

  const withoutPlus = trimmed.slice(1);
  /** Se prueba el país guardado primero y, si no, la lista por largo de prefijo. */
  const candidates = [country, ...[...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)];
  for (const candidate of candidates) {
    if (candidate && withoutPlus.startsWith(candidate.dial)) {
      return { iso: candidate.iso, national: withoutPlus.slice(candidate.dial.length).trim() };
    }
  }
  return { iso: country?.iso ?? DEFAULT_COUNTRY_ISO, national: withoutPlus };
}

export function composePhone(iso: string, national: string): string {
  const country = countryByIso(iso);
  const digits = national.trim();
  if (!digits || !country) return "";
  return `+${country.dial} ${digits}`;
}
