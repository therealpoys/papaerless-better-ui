import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyFontSize, loadFontSize, saveFontSize, type FontSize } from "../lib/fontSize";

const OPTIONS: { value: FontSize; label: string; title: string }[] = [
  { value: "normal", label: "app.fontSize.normal", title: "app.fontSize.normalTitle" },
  { value: "large", label: "app.fontSize.large", title: "app.fontSize.largeTitle" },
  { value: "xlarge", label: "app.fontSize.xlarge", title: "app.fontSize.xlargeTitle" },
];

export function FontSizeSwitch() {
  const { t } = useTranslation();
  const [size, setSize] = useState<FontSize>(loadFontSize);

  useEffect(() => {
    applyFontSize(size);
  }, [size]);

  return (
    <div className="font-switch" role="group" aria-label={t("app.fontSize.groupAriaLabel")}>
      <span className="font-switch__label" aria-hidden="true">
        {t("app.fontSize.label")}
      </span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={size === o.value ? "font-switch__btn font-switch__btn--active" : "font-switch__btn"}
          aria-pressed={size === o.value}
          title={t(o.title)}
          onClick={() => {
            setSize(o.value);
            saveFontSize(o.value);
          }}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}
