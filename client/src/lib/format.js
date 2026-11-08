/** „przed chwilą”, „4 min temu”, „wczoraj”, „3 dni temu”, data. */
export function timeAgo(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 15) return "przed chwilą";
  if (s < 60) return `${s} s temu`;
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "min temu" : `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "godz. temu" : `${h} godz. temu`;
  const d = Math.floor(h / 24);
  if (d === 1) return "wczoraj";
  if (d < 7) return `${d} dni temu`;
  return new Date(ts).toLocaleDateString("pl-PL");
}

export function clock(ts) {
  return new Date(ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export function fullDate(ts) {
  return new Date(ts).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function initials(name = "") {
  const parts = name.replace(/[_-]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Kolor języka programowania (mapa jak na GitHubie, podzbiór). */
const LANG_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572a5",
  Java: "#b07219",
  Go: "#00add8",
  Rust: "#dea584",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Dart: "#00b4ab",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Shell: "#89e051",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Elixir: "#6e4a7e",
  ERLANG: "#b0936a",
  Haskell: "#5e5086",
  Lua: "#000080",
  Scala: "#c22d40",
  Zig: "#ec915c",
  MDX: "#fcb32c",
};

export function langColor(lang) {
  if (!lang) return "#8b93a7";
  return LANG_COLORS[lang] || "#8b93a7";
}
