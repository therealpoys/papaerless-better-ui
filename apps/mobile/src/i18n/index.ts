import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import de from "./locales/de.json";

// Nur "de" ist aktuell befüllt; eine weitere Sprache einzubinden bedeutet
// lediglich: locales/<code>.json anlegen und hier unter resources ergänzen.
export const resources = {
  de: { translation: de },
};

i18next.use(initReactI18next).init({
  resources,
  lng: "de",
  fallbackLng: "de",
  interpolation: { escapeValue: false },
});

export default i18next;
