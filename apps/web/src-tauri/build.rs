use std::env;
use std::fs;
use std::path::Path;

fn main() {
  // Copy model file from project root to src-tauri/models for bundling
  // This MUST happen BEFORE tauri_build::build() so Tauri can find it
  let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
  let src_tauri_dir = Path::new(&manifest_dir);
  
  // Go up to project root: src-tauri -> apps/web -> apps -> project root
  let project_root = src_tauri_dir
    .parent() // apps/web
    .and_then(|p| p.parent()) // apps
    .and_then(|p| p.parent()); // project root
  
  if let Some(root) = project_root {
    let model_source = root.join("models").join("ggml-base.en.bin");
    let model_dest = src_tauri_dir.join("models").join("ggml-base.en.bin");
    
    println!("cargo:warning=Looking for model at: {:?}", model_source);
    println!("cargo:warning=Will copy to: {:?}", model_dest);
    
    if model_source.exists() {
      // Create models directory if it doesn't exist
      if let Some(parent) = model_dest.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
          panic!("Failed to create models directory: {}", e);
        }
      }
      
      // Copy the model file
      match fs::copy(&model_source, &model_dest) {
        Ok(_) => {
          println!("cargo:warning=Successfully copied model for bundling");
          // Tell Cargo to rerun if the source model changes
          println!("cargo:rerun-if-changed={}", model_source.display());
        }
        Err(e) => {
          panic!("Failed to copy model file from {:?} to {:?}: {}", model_source, model_dest, e);
        }
      }
    } else {
      println!("cargo:warning=Model file not found at: {:?}", model_source);
      println!("cargo:warning=Build will continue, but model won't be bundled");
    }
  } else {
    println!("cargo:warning=Could not determine project root from: {:?}", src_tauri_dir);
  }
  
  // Now run Tauri build - it will find the model in src-tauri/models/
  tauri_build::build();
}
