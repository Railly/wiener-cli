export interface CourseResolverConfig {
  fuzzy_confirm_threshold: number;
  fuzzy_unique_delta: number;
  no_input_auto_threshold: number;
  no_match_top_n: number;
}

export interface IntranetConfig {
  base_url: string;
  request_timeout_ms: number;
  user_agent: string;
}

export interface CanvasConfig {
  base_url: string;
  per_page: number;
  request_timeout_ms: number;
  concurrency: number;
  cache_ttl_ms: number;
}

export interface WatchConfig {
  interval_ms: number;
  notify: "macos" | "whatsapp" | "none";
  snooze_until: string | null;
}

export interface PanoramaConfig {
  show_diff: boolean;
  diff_max_age_hours: number;
}

export interface WienerConfig {
  version: number;
  default_profile: string;
  log_level: "debug" | "info" | "warn" | "error";
  log_t0_commands: boolean;
  course_resolver: CourseResolverConfig;
  intranet: IntranetConfig;
  canvas: CanvasConfig;
  watch: WatchConfig;
  panorama: PanoramaConfig;
}

export const DEFAULT_CONFIG: WienerConfig = {
  version: 1,
  default_profile: "default",
  log_level: "info",
  log_t0_commands: false,
  course_resolver: {
    fuzzy_confirm_threshold: 0.85,
    fuzzy_unique_delta: 0.3,
    no_input_auto_threshold: 0.92,
    no_match_top_n: 5,
  },
  intranet: {
    base_url: "https://intranet.uwiener.edu.pe",
    request_timeout_ms: 15000,
    user_agent: "wiener-cli/0.1.0 (+https://github.com/Railly/wiener-cli)",
  },
  canvas: {
    base_url: "https://campus.uwiener.edu.pe",
    per_page: 100,
    request_timeout_ms: 30000,
    concurrency: 4,
    cache_ttl_ms: 300000,
  },
  watch: {
    interval_ms: 1800000,
    notify: "macos",
    snooze_until: null,
  },
  panorama: {
    show_diff: true,
    diff_max_age_hours: 168,
  },
};
