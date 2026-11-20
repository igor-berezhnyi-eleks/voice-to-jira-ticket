import { MenuItem, TextField } from '@eleks-ui/components';
import { useLanguage, useT } from '../i18n/LanguageProvider';
import { isLanguageCode, languages } from '../i18n/languages';

/** The UI language. A labelled native select, so it works from the keyboard and shows each language's own name. */
export function LanguageSelect() {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  return (
    <TextField
      select
      size="small"
      value={language}
      onChange={(event) => {
        if (isLanguageCode(event.target.value)) setLanguage(event.target.value);
      }}
      sx={{ minWidth: 140 }}
      slotProps={{
        select: { native: true },
        htmlInput: { 'aria-label': t.languageSelector },
      }}
    >
      {languages.map(({ code, name }) => (
        <MenuItem key={code} value={code} component="option">
          {name}
        </MenuItem>
      ))}
    </TextField>
  );
}
