use leptos::prelude::*;
use js_sys::{Promise, Reflect};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::{spawn_local, JsFuture};
use web_sys::{HtmlInputElement, HtmlSelectElement};

#[derive(Clone, Copy, PartialEq, Eq)]
enum AppScreen {
    Title,
    NewGame,
    LoadGame,
    Settings,
    Dashboard,
    Match,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum DashboardSection {
    Overview,
    Squad,
    Tactics,
    Schedule,
    Finance,
    Reports,
}

#[derive(Clone, Debug, Deserialize)]
struct LeagueInfo {
    id: String,
    name: String,
    short_name: String,
    country: String,
    club_count: usize,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
struct ClubInfo {
    id: String,
    code: String,
    name: String,
    league: String,
    country: String,
    rating: u8,
}

#[derive(Clone, Debug, Deserialize)]
struct ImportSummary {
    clubs: usize,
    stadiums: usize,
    leagues: usize,
    seasons: usize,
}

#[derive(Serialize)]
struct CreateSessionPayload {
    club_id: String,
}

#[derive(Clone, Debug, Deserialize)]
struct SessionSnapshot {
    session_id: String,
    club: ClubSnapshot,
    league: LeagueSnapshot,
    season: SeasonSnapshot,
    next_fixture: Option<FixtureSnapshot>,
    schedule: Vec<RoundSnapshot>,
    standings: Vec<StandingSnapshot>,
    squad: Vec<PlayerSnapshot>,
}

#[derive(Clone, Debug, Deserialize)]
struct ClubSnapshot {
    id: String,
    name: String,
    short_name: String,
    country: String,
    rating: u8,
}

#[derive(Clone, Debug, Deserialize)]
struct LeagueSnapshot {
    id: String,
    name: String,
    short_name: String,
    country: String,
}

#[derive(Clone, Debug, Deserialize)]
struct SeasonSnapshot {
    id: String,
    name: String,
    year: i32,
    current_round: u8,
    total_rounds: usize,
}

#[derive(Clone, Debug, Deserialize)]
struct FixtureClubSnapshot {
    id: String,
    name: String,
    short_name: String,
}

#[derive(Clone, Debug, Deserialize)]
struct FixtureResultSnapshot {
    home_score: u8,
    away_score: u8,
}

#[derive(Clone, Debug, Deserialize)]
struct FixtureSnapshot {
    id: String,
    round: u8,
    leg: u8,
    home: FixtureClubSnapshot,
    away: FixtureClubSnapshot,
    result: Option<FixtureResultSnapshot>,
}

#[derive(Clone, Debug, Deserialize)]
struct RoundSnapshot {
    number: u8,
    leg: u8,
    fixtures: Vec<FixtureSnapshot>,
    bye: Option<FixtureClubSnapshot>,
}

#[derive(Clone, Debug, Deserialize)]
struct StandingSnapshot {
    position: usize,
    club: FixtureClubSnapshot,
    played: u16,
    wins: u16,
    draws: u16,
    losses: u16,
    goals_for: u16,
    goals_against: u16,
    goal_difference: i16,
    points: u16,
}

#[derive(Clone, Debug, Deserialize)]
struct PlayerSnapshot {
    id: String,
    name: String,
    short_name: String,
    nationality: String,
    form: u8,
    morale: u8,
    energy: u8,
    injured: bool,
}

const ALL_LEAGUES: &str = "All leagues";

#[derive(Serialize)]
struct EmptyPayload;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["window", "__TAURI__", "core"], js_name = invoke)]
    fn tauri_invoke(command: &str, args: JsValue) -> Promise;
}

fn ensure_tauri_available() -> Result<(), String> {
    let global = js_sys::global();
    let tauri_value = Reflect::get(&global, &JsValue::from_str("__TAURI__"))
        .map_err(|err| format!("Failed to access Tauri runtime: {err:?}"))?;
    if tauri_value.is_undefined() || tauri_value.is_null() {
        return Err("Tauri runtime unavailable. Run the desktop app (cargo tauri dev).".to_string());
    }

    let core_value = Reflect::get(&tauri_value, &JsValue::from_str("core"))
        .map_err(|err| format!("Failed to access Tauri core: {err:?}"))?;
    if core_value.is_undefined() || core_value.is_null() {
        return Err("Tauri core API unavailable. Run the desktop app (cargo tauri dev).".to_string());
    }

    let has_invoke = Reflect::has(&core_value, &JsValue::from_str("invoke"))
        .map_err(|err| format!("Failed to access Tauri invoke API: {err:?}"))?;
    if !has_invoke {
        return Err("Tauri invoke API unavailable. Run the desktop app (cargo tauri dev).".to_string());
    }

    Ok(())
}

async fn invoke_tauri<T: DeserializeOwned>(
    command: &str,
    payload: impl Serialize,
) -> Result<T, String> {
    ensure_tauri_available()?;
    let args = serde_wasm_bindgen::to_value(&payload).map_err(|err| err.to_string())?;
    let promise = tauri_invoke(command, args);
    let value = JsFuture::from(promise)
        .await
        .map_err(|err| format!("invoke {command} failed: {err:?}"))?;
    serde_wasm_bindgen::from_value(value).map_err(|err| err.to_string())
}

async fn seed_demo_db() -> Result<ImportSummary, String> {
    invoke_tauri("seed_demo_db", EmptyPayload).await
}

async fn list_leagues() -> Result<Vec<LeagueInfo>, String> {
    invoke_tauri("list_leagues", EmptyPayload).await
}

async fn list_clubs() -> Result<Vec<ClubInfo>, String> {
    invoke_tauri("list_clubs", EmptyPayload).await
}

async fn create_session_snapshot(club_id: &str) -> Result<SessionSnapshot, String> {
    invoke_tauri(
        "create_session_snapshot",
        CreateSessionPayload {
            club_id: club_id.to_string(),
        },
    )
    .await
}

fn event_target_value(event: &leptos::ev::Event) -> String {
    event
        .target()
        .and_then(|target| {
            target
                .dyn_ref::<HtmlInputElement>()
                .map(|input| input.value())
                .or_else(|| target.dyn_ref::<HtmlSelectElement>().map(|select| select.value()))
        })
        .unwrap_or_default()
}

fn main() {
    mount_to_body(App);
}

#[component]
fn App() -> impl IntoView {
    let (screen, set_screen) = signal(AppScreen::Title);
    let (section, set_section) = signal(DashboardSection::Overview);
    let (session_snapshot, set_session_snapshot) = create_signal::<Option<SessionSnapshot>>(None);

    let to_title = {
        let set_screen = set_screen;
        Callback::new(move |_| set_screen.set(AppScreen::Title))
    };
    let to_new_game = {
        let set_screen = set_screen;
        Callback::new(move |_| set_screen.set(AppScreen::NewGame))
    };
    let to_load_game = {
        let set_screen = set_screen;
        Callback::new(move |_| set_screen.set(AppScreen::LoadGame))
    };
    let to_settings = {
        let set_screen = set_screen;
        Callback::new(move |_| set_screen.set(AppScreen::Settings))
    };
    let to_exit = Callback::new(move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            window().close();
        }
    });
    let to_dashboard = {
        let set_screen = set_screen;
        let set_section = set_section;
        Callback::new(move |_| {
            set_section.set(DashboardSection::Overview);
            set_screen.set(AppScreen::Dashboard);
        })
    };
    let to_match = {
        let set_screen = set_screen;
        Callback::new(move |_| set_screen.set(AppScreen::Match))
    };

    view! {
        <div class="app-root">
            <Show when=move || screen.get() == AppScreen::Title fallback=|| ()>
                <TitleScreen
                    on_start=to_new_game.clone()
                    on_load=to_load_game.clone()
                    on_settings=to_settings.clone()
                    on_exit=to_exit.clone()
                />
            </Show>
            <Show when=move || screen.get() == AppScreen::NewGame fallback=|| ()>
                <NewGameScreen
                    on_back=to_title.clone()
                    on_create=to_dashboard.clone()
                    set_session=set_session_snapshot
                />
            </Show>
            <Show when=move || screen.get() == AppScreen::LoadGame fallback=|| ()>
                <LoadGameScreen on_back=to_title.clone() on_open=to_dashboard.clone() />
            </Show>
            <Show when=move || screen.get() == AppScreen::Settings fallback=|| ()>
                <SettingsScreen on_back=to_title.clone() />
            </Show>
            <Show when=move || screen.get() == AppScreen::Dashboard fallback=|| ()>
                <DashboardScreen
                    active_section=section
                    set_section=set_section
                    session=session_snapshot
                    on_simulate=to_match.clone()
                    on_exit=to_title.clone()
                />
            </Show>
            <Show when=move || screen.get() == AppScreen::Match fallback=|| ()>
                <MatchScreen on_back=to_dashboard.clone() />
            </Show>
        </div>
    }
}

#[component]
fn TitleScreen(
    on_start: Callback<()>,
    on_load: Callback<()>,
    on_settings: Callback<()>,
    on_exit: Callback<()>,
) -> impl IntoView {
    view! {
        <section class="screen title-screen minimal">
            <button
                class="icon-button title-settings"
                aria-label="Settings"
                on:click=move |_| on_settings.run(())
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="3.25"></circle>
                    <path
                        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.54V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.54 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1z"
                    ></path>
                </svg>
            </button>
            <div class="title-core">
                <img class="title-logo" src="openfoot.png" alt="OpenFoot Manager logo" />
                <div class="title-actions stack">
                    <button class="btn primary" on:click=move |_| on_start.run(())>
                        "Start Game"
                    </button>
                    <button class="btn primary" on:click=move |_| on_load.run(())>
                        "Load Game"
                    </button>
                    <button class="btn primary" on:click=move |_| on_exit.run(())>
                        "Exit"
                    </button>
                </div>
            </div>
            <div class="title-version">"Version 0.1"</div>
        </section>
    }
}

#[component]
fn NewGameScreen(
    on_back: Callback<()>,
    on_create: Callback<()>,
    set_session: WriteSignal<Option<SessionSnapshot>>,
) -> impl IntoView {
    let (clubs, set_clubs) = create_signal(Vec::<ClubInfo>::new());
    let (leagues, set_leagues) = create_signal(Vec::<LeagueInfo>::new());
    let (selected, set_selected) = create_signal::<Option<String>>(None);
    let (search, set_search) = create_signal(String::new());
    let (league_filter, set_league_filter) = create_signal(ALL_LEAGUES.to_string());
    let (loading, set_loading) = create_signal(false);
    let (error, set_error) = create_signal::<Option<String>>(None);
    let (summary, set_summary) = create_signal::<Option<ImportSummary>>(None);
    let (session_loading, set_session_loading) = create_signal(false);
    let (session_error, set_session_error) = create_signal::<Option<String>>(None);

    let filtered_clubs = create_memo(move |_| {
        let query = search.get().to_lowercase();
        let league_filter = league_filter.get();
        clubs
            .get()
            .into_iter()
            .filter(|club| {
                let matches_query = query.is_empty()
                    || club.name.to_lowercase().contains(&query)
                    || club.code.to_lowercase().contains(&query);
                let matches_league = league_filter == ALL_LEAGUES || club.league == league_filter;
                matches_query && matches_league
            })
            .collect::<Vec<_>>()
    });

    let status_message = create_memo(move |_| {
        if loading.get() {
            Some("Loading sample data pack...".to_string())
        } else if let Some(error) = error.get() {
            Some(format!("Failed to load data pack: {error}"))
        } else if let Some(summary) = summary.get() {
            Some(format!(
                "Loaded {} clubs, {} leagues, {} seasons.",
                summary.clubs, summary.leagues, summary.seasons
            ))
        } else {
            None
        }
    });

    let session_status = create_memo(move |_| {
        if session_loading.get() {
            Some("Creating session...".to_string())
        } else {
            session_error.get()
        }
    });

    let load_pack = Callback::new(move |_| {
        set_loading.set(true);
        set_error.set(None);
        set_summary.set(None);
        let set_loading = set_loading;
        let set_error = set_error;
        let set_summary = set_summary;
        let set_clubs = set_clubs;
        let set_leagues = set_leagues;
        let set_selected = set_selected;
        spawn_local(async move {
            let summary = match seed_demo_db().await {
                Ok(summary) => summary,
                Err(err) => {
                    set_error.set(Some(err));
                    set_loading.set(false);
                    return;
                }
            };

            let leagues = match list_leagues().await {
                Ok(leagues) => leagues,
                Err(err) => {
                    set_error.set(Some(err));
                    set_loading.set(false);
                    return;
                }
            };
            let clubs = match list_clubs().await {
                Ok(clubs) => clubs,
                Err(err) => {
                    set_error.set(Some(err));
                    set_loading.set(false);
                    return;
                }
            };
            let first = clubs.first().map(|club| club.id.clone());
            set_leagues.set(leagues);
            set_clubs.set(clubs);
            set_selected.set(first);
            set_summary.set(Some(summary));
            set_loading.set(false);
        });
    });

    let load_pack_effect = load_pack.clone();
    create_effect(move |_| {
        load_pack_effect.run(());
    });

    let create_session = {
        let on_create = on_create.clone();
        Callback::new(move |_| {
            let club_id = match selected.get() {
                Some(id) => id,
                None => return,
            };
            set_session_loading.set(true);
            set_session_error.set(None);
            let set_session_loading = set_session_loading;
            let set_session_error = set_session_error;
            let set_session = set_session;
            let on_create = on_create.clone();
            spawn_local(async move {
                match create_session_snapshot(&club_id).await {
                    Ok(snapshot) => {
                        set_session.set(Some(snapshot));
                        set_session_loading.set(false);
                        on_create.run(());
                    }
                    Err(err) => {
                        set_session_error.set(Some(format!(
                            "Failed to create session: {err}"
                        )));
                        set_session_loading.set(false);
                    }
                }
            });
        })
    };

    view! {
        <section class="screen session-screen">
            <div class="screen-header">
                <div>
                    <div class="title-eyebrow">"New session"</div>
                    <h2>"Manager setup"</h2>
                    <p class="muted">"Create a profile and select a club to manage."</p>
                </div>
                <div class="header-actions">
                    <button class="btn ghost" on:click=move |_| on_back.run(())>
                        "Back"
                    </button>
                </div>
            </div>

            <div class="setup-grid">
                <div class="panel">
                    <div class="panel-title">"Manager profile"</div>
                    <div class="form-grid">
                        <label>
                            <span class="label">"Full name"</span>
                            <input type="text" placeholder="Manager name" />
                        </label>
                        <label>
                            <span class="label">"Nationality"</span>
                            <select>
                                <option>"Testland"</option>
                                <option>"Neutral"</option>
                                <option>"Custom"</option>
                            </select>
                        </label>
                        <label>
                            <span class="label">"Experience"</span>
                            <select>
                                <option>"Continental"</option>
                                <option>"National"</option>
                                <option>"Regional"</option>
                            </select>
                        </label>
                        <label>
                            <span class="label">"Preferred style"</span>
                            <select>
                                <option>"Balanced"</option>
                                <option>"Possession"</option>
                                <option>"Direct"</option>
                            </select>
                        </label>
                    </div>
                    <div class="panel-footer">
                        <div class="meta-grid">
                            <div>
                                <div class="label">"Board expectations"</div>
                                <div class="value">"Top half"</div>
                            </div>
                            <div>
                                <div class="label">"Budget"</div>
                                <div class="value">"$4.5M"</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-title">"Club selection"</div>
                    <Show when=move || status_message.get().is_some() fallback=|| ()>
                        <div
                            class="status-row"
                            class:negative=move || error.get().is_some()
                            class:positive=move || summary.get().is_some() && !loading.get()
                        >
                            <span class="status-spinner" class:active=move || loading.get()></span>
                            <span>{move || status_message.get().unwrap_or_default()}</span>
                        </div>
                    </Show>
                    <div class="filters">
                        <input
                            type="text"
                            placeholder="Search club"
                            value=move || search.get()
                            on:input=move |ev| set_search.set(event_target_value(&ev))
                        />
                        <select on:change=move |ev| set_league_filter.set(event_target_value(&ev))>
                            <option
                                value=ALL_LEAGUES
                                selected=move || league_filter.get() == ALL_LEAGUES
                            >
                                {ALL_LEAGUES}
                            </option>
                            {move || {
                                leagues
                                    .get()
                                    .into_iter()
                                    .map(|league| {
                                        let label = format!(
                                            "{} ({})",
                                            league.name, league.club_count
                                        );
                                        let value = league.name.clone();
                                        let selected_value = value.clone();
                                        view! {
                                            <option
                                                value=value
                                                selected=move || league_filter.get() == selected_value
                                            >
                                                {label}
                                            </option>
                                        }
                                    })
                                    .collect::<Vec<_>>()
                            }}
                        </select>
                        <select>
                            <option>"Rating"</option>
                            <option>"Budget"</option>
                            <option>"Form"</option>
                        </select>
                    </div>
                    <div class="club-list">
                        <Show
                            when=move || !filtered_clubs.get().is_empty()
                            fallback=|| {
                                view! {
                                    <div class="empty-state muted">
                                        "No clubs loaded yet. Load the sample pack to continue."
                                    </div>
                                }
                            }
                        >
                            {move || {
                                filtered_clubs
                                    .get()
                                    .into_iter()
                                    .map(|club| {
                                        let selected = selected;
                                        let set_selected = set_selected;
                                        let club_id = club.id.clone();
                                        let club_id_for_class = club_id.clone();
                                        view! {
                                            <button
                                                class="club-row"
                                                class:active=move || {
                                                    selected
                                                        .get()
                                                        .as_deref()
                                                        == Some(club_id_for_class.as_str())
                                                }
                                                on:click=move |_| set_selected.set(Some(club_id.clone()))
                                            >
                                                <div class="club-left">
                                                    <div class="club-code">{club.code}</div>
                                                    <div>
                                                        <div class="club-name">{club.name}</div>
                                                        <div class="muted">
                                                            {club.league} " - " {club.country}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="club-rating">
                                                    <span class="rating">{club.rating}</span>
                                                    <span class="muted">"Overall"</span>
                                                </div>
                                            </button>
                                        }
                                    })
                                    .collect::<Vec<_>>()
                            }}
                        </Show>
                    </div>
                    <Show when=move || session_status.get().is_some() fallback=|| ()>
                        <div
                            class="status-row"
                            class:negative=move || session_error.get().is_some()
                        >
                            <span
                                class="status-spinner"
                                class:active=move || session_loading.get()
                            ></span>
                            <span>{move || session_status.get().unwrap_or_default()}</span>
                        </div>
                    </Show>
                    <div class="panel-footer align-right">
                        <button
                            class="btn ghost"
                            disabled=move || loading.get()
                            on:click=move |_| load_pack.run(())
                        >
                            {move || {
                                if loading.get() {
                                    "Loading sample data..."
                                } else {
                                    "Load sample data pack"
                                }
                            }}
                        </button>
                        <button
                            class="btn primary"
                            disabled=move || {
                                selected.get().is_none() || loading.get() || session_loading.get()
                            }
                            on:click=move |_| create_session.run(())
                        >
                            "Create session"
                        </button>
                    </div>
                </div>
            </div>
        </section>
    }
}

#[component]
fn LoadGameScreen(on_back: Callback<()>, on_open: Callback<()>) -> impl IntoView {
    view! {
        <section class="screen session-screen">
            <div class="screen-header">
                <div>
                    <div class="title-eyebrow">"Load session"</div>
                    <h2>"Saved games"</h2>
                    <p class="muted">"Pick a session to continue."</p>
                </div>
                <div class="header-actions">
                    <button class="btn ghost" on:click=move |_| on_back.run(())>
                        "Back"
                    </button>
                </div>
            </div>

            <div class="panel">
                <div class="panel-title">"Sessions"</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>"Session"</th>
                            <th>"Club"</th>
                            <th>"Date"</th>
                            <th>"Progress"</th>
                            <th>"Status"</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>"Sample season"</td>
                            <td>"Atlas FC"</td>
                            <td>"2026-01-12"</td>
                            <td>"Week 2"</td>
                            <td class="positive">"Active"</td>
                        </tr>
                        <tr>
                            <td>"Training save"</td>
                            <td>"Harbor Town"</td>
                            <td>"2026-01-04"</td>
                            <td>"Week 1"</td>
                            <td class="muted">"Paused"</td>
                        </tr>
                    </tbody>
                </table>
                <div class="panel-footer align-right">
                    <button class="btn primary" on:click=move |_| on_open.run(())>
                        "Open session"
                    </button>
                </div>
            </div>
        </section>
    }
}

#[component]
fn SettingsScreen(on_back: Callback<()>) -> impl IntoView {
    view! {
        <section class="screen session-screen">
            <div class="screen-header">
                <div>
                    <div class="title-eyebrow">"Settings"</div>
                    <h2>"Interface"</h2>
                    <p class="muted">"Tune display and interaction defaults."</p>
                </div>
                <div class="header-actions">
                    <button class="btn ghost" on:click=move |_| on_back.run(())>
                        "Back"
                    </button>
                </div>
            </div>

            <div class="panel">
                <div class="panel-title">"Display"</div>
                <div class="form-grid">
                    <label>
                        <span class="label">"Theme"</span>
                        <select>
                            <option>"Dark (default)"</option>
                            <option>"Dim"</option>
                        </select>
                    </label>
                    <label>
                        <span class="label">"Accent"</span>
                        <select>
                            <option>"Muted green"</option>
                            <option>"Deep blue"</option>
                            <option>"Burgundy"</option>
                        </select>
                    </label>
                    <label>
                        <span class="label">"Density"</span>
                        <select>
                            <option>"Balanced"</option>
                            <option>"Compact"</option>
                        </select>
                    </label>
                    <label>
                        <span class="label">"Table numbers"</span>
                        <select>
                            <option>"Tabular"</option>
                            <option>"Standard"</option>
                        </select>
                    </label>
                </div>
            </div>
        </section>
    }
}

#[component]
fn DashboardScreen(
    active_section: ReadSignal<DashboardSection>,
    set_section: WriteSignal<DashboardSection>,
    session: ReadSignal<Option<SessionSnapshot>>,
    on_simulate: Callback<()>,
    on_exit: Callback<()>,
) -> impl IntoView {
    let nav_items = vec![
        (DashboardSection::Overview, "Overview"),
        (DashboardSection::Squad, "Squad"),
        (DashboardSection::Tactics, "Tactics"),
        (DashboardSection::Schedule, "Schedule"),
        (DashboardSection::Finance, "Finance"),
        (DashboardSection::Reports, "Reports"),
    ];

    view! {
        <section class="dashboard-shell">
            <header class="top-bar">
                <div class="top-left">
                    <div class="club-badge">"ATL"</div>
                    <div>
                        <div class="top-title">"Atlas FC"</div>
                        <div class="muted">"Test League"</div>
                    </div>
                </div>
                <div class="top-center">
                    <div class="context-pill">"Week 3"</div>
                    <div class="context-pill">"2026-02-02"</div>
                    <div class="context-pill">"Home"</div>
                </div>
                <div class="top-right">
                    <input class="search" type="search" placeholder="Search players, staff, fixtures" />
                    <button class="btn ghost" on:click=move |_| on_exit.run(())>
                        "Exit"
                    </button>
                </div>
            </header>

            <aside class="sidebar">
                <div class="nav-section">
                    {nav_items
                        .iter()
                        .map(|(section, label)| {
                            let section_value = *section;
                            view! {
                                <button
                                    class="nav-item"
                                    class:active=move || active_section.get() == section_value
                                    on:click=move |_| set_section.set(section_value)
                                >
                                    <span>{*label}</span>
                                </button>
                            }
                        })
                        .collect::<Vec<_>>()}
                </div>
                <div class="nav-section">
                    <button class="nav-item">"Inbox"</button>
                    <button class="nav-item">"Scouting"</button>
                    <button class="nav-item">"Medical"</button>
                </div>
            </aside>

            <main class="dashboard-main">
                <div class="section-header">
                    <h2>{move || match active_section.get() {
                        DashboardSection::Overview => "Overview",
                        DashboardSection::Squad => "Squad",
                        DashboardSection::Tactics => "Tactics",
                        DashboardSection::Schedule => "Schedule",
                        DashboardSection::Finance => "Finance",
                        DashboardSection::Reports => "Reports",
                    }}</h2>
                    <div class="section-actions">
                        <button class="btn ghost">"Export"</button>
                        <button class="btn primary" on:click=move |_| on_simulate.run(())>
                            "Simulate match"
                        </button>
                    </div>
                </div>

                <div class="grid-two">
                    <div class="panel">
                        <div class="panel-title">"Next fixture"</div>
                        <div class="fixture-card">
                            <div>
                                <div class="label">"Week 3"</div>
                                <div class="fixture-team">"Atlas FC"</div>
                                <div class="muted">"Home"</div>
                            </div>
                            <div class="fixture-score">"-"</div>
                            <div>
                                <div class="label">"Opponent"</div>
                                <div class="fixture-team">"Harbor Town"</div>
                                <div class="muted">"Away"</div>
                            </div>
                        </div>
                        <div class="panel-footer align-right">
                            <button class="btn ghost">"Match plan"</button>
                            <button class="btn primary" on:click=move |_| on_simulate.run(())>
                                "Play"
                            </button>
                        </div>
                    </div>

                    <div class="panel">
                        <div class="panel-title">"Table"</div>
                        <table class="data-table compact">
                            <thead>
                                <tr>
                                    <th>"#"</th>
                                    <th>"Club"</th>
                                    <th>"P"</th>
                                    <th>"Pts"</th>
                                    <th>"GD"</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>"1"</td>
                                    <td>"Atlas FC"</td>
                                    <td>"2"</td>
                                    <td>"6"</td>
                                    <td class="positive">"+4"</td>
                                </tr>
                                <tr>
                                    <td>"2"</td>
                                    <td>"Harbor Town"</td>
                                    <td>"2"</td>
                                    <td>"3"</td>
                                    <td class="muted">"0"</td>
                                </tr>
                                <tr>
                                    <td>"3"</td>
                                    <td>"Nova Athletic"</td>
                                    <td>"2"</td>
                                    <td>"1"</td>
                                    <td class="negative">"-2"</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="grid-three">
                    <div class="panel">
                        <div class="panel-title">"Squad status"</div>
                        <div class="stat-row">
                            <span>"Available"</span>
                            <span class="value">"18"</span>
                        </div>
                        <div class="stat-row">
                            <span>"Injured"</span>
                            <span class="value negative">"2"</span>
                        </div>
                        <div class="stat-row">
                            <span>"Tired"</span>
                            <span class="value warning">"4"</span>
                        </div>
                    </div>
                    <div class="panel">
                        <div class="panel-title">"Board"</div>
                        <div class="stat-row">
                            <span>"Confidence"</span>
                            <span class="value positive">"High"</span>
                        </div>
                        <div class="stat-row">
                            <span>"Budget"</span>
                            <span class="value">"$4.5M"</span>
                        </div>
                        <div class="stat-row">
                            <span>"Wage"</span>
                            <span class="value">"$180K"</span>
                        </div>
                    </div>
                    <div class="panel">
                        <div class="panel-title">"Form trend"</div>
                        <div class="trend-line">
                            <div class="trend-bar" style="width: 75%"></div>
                        </div>
                        <div class="trend-meta">
                            <span class="muted">"Last 5"</span>
                            <span class="value positive">"W W D W W"</span>
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-title">"Reports"</div>
                    <div class="report-grid">
                        <div class="report-card">
                            <div class="label">"Training"</div>
                            <div class="value">"Focus on recovery"</div>
                        </div>
                        <div class="report-card">
                            <div class="label">"Scouting"</div>
                            <div class="value">"2 prospects short-listed"</div>
                        </div>
                        <div class="report-card">
                            <div class="label">"Medical"</div>
                            <div class="value warning">"1 player flagged"</div>
                        </div>
                    </div>
                </div>
            </main>
        </section>
    }
}

#[component]
fn MatchScreen(on_back: Callback<()>) -> impl IntoView {
    view! {
        <section class="screen match-screen">
            <div class="screen-header compact">
                <div>
                    <div class="title-eyebrow">"Match center"</div>
                    <h2>"Atlas FC vs Harbor Town"</h2>
                    <p class="muted">"Week 3 - Test League"</p>
                </div>
                <div class="header-actions">
                    <button class="btn ghost" on:click=move |_| on_back.run(())>
                        "Back"
                    </button>
                </div>
            </div>

            <div class="match-grid">
                <div class="panel score-panel">
                    <div class="score-line">
                        <div>
                            <div class="label">"Home"</div>
                            <div class="fixture-team">"Atlas FC"</div>
                        </div>
                        <div class="score-value">"1 - 0"</div>
                        <div>
                            <div class="label">"Away"</div>
                            <div class="fixture-team">"Harbor Town"</div>
                        </div>
                    </div>
                    <div class="score-meta">
                        <span class="context-pill">"65'"</span>
                        <span class="context-pill">"Possession 54%"</span>
                        <span class="context-pill">"Shots 9-4"</span>
                    </div>
                    <div class="panel-footer align-right">
                        <button class="btn">"Pause"</button>
                        <button class="btn primary">"Finish"</button>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-title">"Key events"</div>
                    <ul class="event-log">
                        <li>
                            <span class="time">"12'"</span>
                            <span class="event">"Chance created from right flank"</span>
                        </li>
                        <li>
                            <span class="time">"28'"</span>
                            <span class="event">"Goal: Atlas FC finishes from inside the box"</span>
                        </li>
                        <li>
                            <span class="time">"55'"</span>
                            <span class="event">"Harbor Town shot saved"</span>
                        </li>
                        <li>
                            <span class="time">"64'"</span>
                            <span class="event">"Substitution: fresh striker"</span>
                        </li>
                    </ul>
                </div>

                <div class="panel">
                    <div class="panel-title">"Live metrics"</div>
                    <div class="stat-grid">
                        <div>
                            <div class="label">"xG"</div>
                            <div class="value">"1.2"</div>
                        </div>
                        <div>
                            <div class="label">"PPDA"</div>
                            <div class="value">"9.1"</div>
                        </div>
                        <div>
                            <div class="label">"Passes"</div>
                            <div class="value">"312"</div>
                        </div>
                        <div>
                            <div class="label">"Duels"</div>
                            <div class="value">"48%"</div>
                        </div>
                    </div>
                    <div class="possession-bar">
                        <div class="possession home" style="width: 54%"></div>
                        <div class="possession away" style="width: 46%"></div>
                    </div>
                </div>
            </div>
        </section>
    }
}
