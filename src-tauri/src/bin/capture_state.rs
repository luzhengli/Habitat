use habitat_lib::skills::{
    inspect_git_status_for_capture, link_skill, preflight_link, scan_project, scan_store, unlink_skill,
    CommandResult, Preflight, ProjectScan, StoreScan,
};
use serde::Serialize;
use std::env;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureState {
    store: StoreScan,
    project: ProjectScan,
    preflight: Preflight,
    git_status: CommandResult,
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 6 {
        eprintln!("usage: capture_state <store> <project> <skill> <none|link|unlink> <output.json>");
        std::process::exit(2);
    }
    let store = &args[1];
    let project = &args[2];
    let skill = &args[3];
    let action = &args[4];

    let result = (|| {
        match action.as_str() {
            "none" => {}
            "link" => {
                link_skill(store, project, skill)?;
            }
            "unlink" => {
                unlink_skill(store, project, skill)?;
            }
            _ => {
                eprintln!("action must be none, link, or unlink");
                std::process::exit(2);
            }
        }
        Ok::<CaptureState, habitat_lib::skills::AppError>(CaptureState {
            store: scan_store(store)?,
            project: scan_project(project, store)?,
            preflight: preflight_link(store, project, skill)?,
            git_status: inspect_git_status_for_capture(project)?,
        })
    })();

    match result {
        Ok(state) => {
            let json = serde_json::to_string_pretty(&state).unwrap();
            if let Err(error) = std::fs::write(&args[5], json) {
                eprintln!("failed to write {}: {error}", args[5]);
                std::process::exit(1);
            }
        }
        Err(error) => {
            eprintln!("{}", serde_json::to_string_pretty(&error).unwrap());
            std::process::exit(1);
        }
    }
}
