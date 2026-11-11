"""Scratch: log read_package_project's entry, exit, duration and response size to $OFM_TRACE_FILE.
usage: python patch_trace.py <package_editor.rs>"""
import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()
old = "#[tauri::command]\npub fn read_package_project(dir: String) -> Result<PackageProjectData, String> {"
assert s.count(old) == 1, "read_package_project not found as expected"
new = """fn ofm_trace(line: &str) {
    if let Ok(file) = std::env::var("OFM_TRACE_FILE") {
        use std::io::Write;
        if let Ok(mut out) = std::fs::OpenOptions::new().create(true).append(true).open(file) {
            let at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            let _ = writeln!(out, "{at} {line}");
        }
    }
}

#[tauri::command]
pub fn read_package_project(dir: String) -> Result<PackageProjectData, String> {
    let started = std::time::Instant::now();
    ofm_trace(&format!("read_package_project enter dir={dir}"));
    let result = read_package_project_inner(dir);
    let took = started.elapsed().as_millis();
    let size = result
        .as_ref()
        .ok()
        .map(|data| serde_json::to_vec(data).map(|bytes| bytes.len()).unwrap_or(0));
    ofm_trace(&format!(
        "read_package_project exit ms={took} ok={} response_bytes={size:?} total_ms_with_size={}",
        result.is_ok(),
        started.elapsed().as_millis()
    ));
    result
}

pub fn read_package_project_inner(dir: String) -> Result<PackageProjectData, String> {"""
s = s.replace(old, new)
open(path, "w", encoding="utf-8").write(s)
print("patched")
