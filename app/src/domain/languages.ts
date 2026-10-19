import {normalize} from './model.ts';

export interface LanguageOption {value: string; label: string; search: string; codes: string[]; englishName?: string}
let catalogPromise: Promise<LanguageOption[]> | undefined;

// Carregado uma única vez, de um módulo local, sem consultar serviços externos.
export function loadLanguageCatalog(): Promise<LanguageOption[]> {
  return catalogPromise ??= import('iso-639-3').then(({iso6393}) => {
    const names = new Intl.DisplayNames(['pt-BR'], {type: 'language', fallback: 'none'});
    const entries = iso6393.filter(language => language.scope !== 'special').map(language => {
      const translated = names.of(language.iso6391 ?? language.iso6393) ?? language.name;
      return {language, label: translated.charAt(0).toLocaleUpperCase('pt-BR') + translated.slice(1)};
    });
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(normalize(entry.label), (counts.get(normalize(entry.label)) ?? 0) + 1);
    return entries.map(({language, label}): LanguageOption => {
      // Nomes traduzidos iguais não devem confundir idiomas distintos.
      if (counts.get(normalize(label))! > 1) label += ` (${language.iso6393})`;
      const codes = [language.iso6393, language.iso6391, language.iso6392B, language.iso6392T].filter((code): code is string => !!code);
      return {value: 'language:' + normalize(label), label, codes, englishName: language.name, search: normalize([label, language.name, ...codes].join(' '))};
    }).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }).catch(error => {catalogPromise = undefined; throw error;});
}

export function customLanguage(label: string): LanguageOption {
  return {value: 'language:' + normalize(label), label, search: normalize(label), codes: []};
}

export function suggestLanguages(catalog: LanguageOption[], saved: string[], selected: string[]): LanguageOption[] {
  const counts = new Map<string, {label: string; count: number}>();
  for (const label of saved) {
    const key = normalize(label);
    const prior = counts.get(key);
    counts.set(key, {label: prior?.label ?? label, count: (prior?.count ?? 0) + 1});
  }
  const byLabel = new Map(catalog.map(option => [normalize(option.label), option]));
  const byCode = new Map(catalog.flatMap(option => option.codes.map(code => [code, option] as const)));
  // Sugestões iniciais de navegação; a busca continua cobrindo todo o catálogo.
  const starters = [['por', 'Português'], ['eng', 'Inglês'], ['spa', 'Espanhol'], ['fra', 'Francês'], ['ita', 'Italiano'], ['deu', 'Alemão'], ['jpn', 'Japonês'], ['kor', 'Coreano'], ['zho', 'Chinês'], ['ara', 'Árabe'], ['hin', 'Hindi'], ['rus', 'Russo']];
  const used = [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
    .map(item => byLabel.get(normalize(item.label)) ?? customLanguage(item.label));
  const candidates = [...used, ...starters.map(([code, label]) => byCode.get(code) ?? {...customLanguage(label), codes: [code]})];
  const seen = new Set<string>();
  const suggestions = candidates.filter(option => {
    const key = normalize(option.label);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 12);
  const visible = new Set(suggestions.map(option => normalize(option.label)));
  for (const label of selected) {
    const key = normalize(label);
    if (!visible.has(key)) {suggestions.push(byLabel.get(key) ?? customLanguage(label)); visible.add(key);}
  }
  return suggestions;
}

export function allLanguageOptions(catalog: LanguageOption[], saved: string[], selected: string[]): LanguageOption[] {
  return [...new Map([...suggestLanguages(catalog, saved, selected), ...catalog].map(option => [option.value, option])).values()];
}

export function searchLanguages(catalog: LanguageOption[], query: string, saved: string[], selected: string[]): LanguageOption[] {
  const options = new Map(catalog.map(option => [normalize(option.label), option]));
  for (const label of [...saved, ...selected]) if (!options.has(normalize(label))) options.set(normalize(label), customLanguage(label));
  const term = normalize(query);
  const score = (option: LanguageOption) => normalize(option.label) === term || option.codes.includes(term) ? 0 : normalize(option.label).startsWith(term) ? 1 : 2;
  return [...options.values()].filter(option => option.search.includes(term))
    .sort((a, b) => score(a) - score(b) || a.label.localeCompare(b.label, 'pt-BR')).slice(0, 60);
}
