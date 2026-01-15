use leptos::prelude::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["window", "__TAURI__", "core"])]
    async fn invoke(cmd: &str, args: JsValue) -> JsValue;
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct SaveListItem {
    id: String,
    created_unix_seconds: u64,
    display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct CreateNewGameArgs {
    display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct RunDemoMatchArgs {
    seed: u64,
}

#[derive(Debug, Clone, Serialize)]
struct OpenSaveArgs {
    id: String,
}

#[derive(Debug, Clone, Serialize)]
struct EmptyArgs {}

#[component]
fn App() -> impl IntoView {
    let (saves, set_saves) = signal::<Vec<SaveListItem>>(Vec::new());
    let (selected, set_selected) = signal::<Option<SaveListItem>>(None);
    let (demo_commentary, set_demo_commentary) = signal::<Vec<String>>(Vec::new());

    let refresh = move || {
        spawn_local(async move {
            let args = serde_wasm_bindgen::to_value(&EmptyArgs {}).unwrap_or(JsValue::NULL);
            let v = invoke("list_saves", args).await;
            let parsed: Vec<SaveListItem> = serde_wasm_bindgen::from_value(v).unwrap_or_default();
            set_saves.set(parsed);
        });
    };

    let new_game = move || {
        spawn_local(async move {
            let args = serde_wasm_bindgen::to_value(&CreateNewGameArgs {
                display_name: Some("New Save".to_string()),
            })
            .unwrap_or(JsValue::NULL);
            let v = invoke("create_new_game", args).await;
            let _created: SaveListItem = serde_wasm_bindgen::from_value(v).unwrap();
            refresh();
        });
    };

    let run_demo = move || {
        spawn_local(async move {
            let args = serde_wasm_bindgen::to_value(&RunDemoMatchArgs { seed: 42 })
                .unwrap_or(JsValue::NULL);
            let v = invoke("run_demo_match", args).await;
            let lines: Vec<String> = serde_wasm_bindgen::from_value(v).unwrap_or_default();
            set_demo_commentary.set(lines);
        });
    };

    let select_save = move |id: String| {
        spawn_local(async move {
            let args = serde_wasm_bindgen::to_value(&OpenSaveArgs { id })
                .unwrap_or(JsValue::NULL);
            let v = invoke("open_save", args).await;
            let opened: SaveListItem = serde_wasm_bindgen::from_value(v).unwrap();
            set_selected.set(Some(opened));
        });
    };

    Effect::new(move |_| {
        refresh();
    });

    view! {
        <main style="font-family: system-ui; padding: 24px;">
            <h1>"Openfoot Manager"</h1>

            <section style="display: flex; gap: 12px; margin: 16px 0;">
                <button on:click=move |_| new_game()>"New Game"</button>
                <button on:click=move |_| refresh()>"Load Game"</button>
                <button on:click=move |_| run_demo()>"Run Demo Match"</button>
            </section>

            <section style="display: flex; gap: 24px;">
                <div style="min-width: 320px;">
                    <h2>"Saves"</h2>
                    <ul>
                        {move || {
                            saves
                                .get()
                                .into_iter()
                                .map(|s| {
                                    let id = s.id.clone();
                                    view! {
                                        <li>
                                            <button on:click=move |_| select_save(id.clone())>
                                                {s.display_name.clone().unwrap_or_else(|| s.id.clone())}
                                            </button>
                                        </li>
                                    }
                                })
                                .collect_view()
                        }}
                    </ul>
                </div>

                <div style="flex: 1;">
                    <h2>"Selected"</h2>
                    <pre>{move || format!("{:#?}", selected.get())}</pre>

                    <h2>"Demo Commentary"</h2>
                    <pre>{move || demo_commentary.get().join("\n")}</pre>
                </div>
            </section>
        </main>
    }
}

fn main() {
    leptos::mount::mount_to_body(App)
}
