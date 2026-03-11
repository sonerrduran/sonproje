# Desktop App Architecture — Tauri

## Why Tauri over Electron?
| | Tauri | Electron |
|--|--|--|
| Bundle size | ~15MB | ~150MB |
| Memory usage | ~50MB | ~300MB |
| Performance | Native WebView | Chromium |
| Rust backend | ✅ | ❌ |
| Web tech | ✅ (HTML/CSS/JS) | ✅ |

## Tech Stack
- **Shell**: Tauri 2.x (Rust)
- **Frontend**: Same Next.js web app (static build) or Vite
- **Languages**: Rust (native features) + TypeScript (UI)

## Folder Structure
```
apps/desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              ← Tauri app entry
│   │   ├── commands/
│   │   │   ├── offline.rs       ← Cache lessons to disk
│   │   │   ├── filesystem.rs    ← Save/load game state
│   │   │   └── auth.rs          ← Secure token storage (keyring)
│   │   └── lib.rs
│   ├── tauri.conf.json
│   └── Cargo.toml
├── src/                         ← Vite/Next.js frontend (same as web)
│   ├── store/                   ← Shared auth/game store
│   ├── components/              ← Reuse web components
│   └── pages/
│       ├── dashboard.tsx
│       ├── lessons/[id].tsx
│       └── games/[id].tsx
└── package.json
```

## Native Features via Tauri Commands
```rust
// Rust command: cache lesson to disk for offline use
#[tauri::command]
async fn cache_lesson(lesson_id: String, content: String) -> Result<(), String> {
    let path = dirs::data_dir().unwrap().join("galactic").join(&lesson_id);
    std::fs::write(path, content).map_err(|e| e.to_string())
}

// Rust command: store JWT securely in OS keychain
#[tauri::command]
async fn store_token(token: String) -> Result<(), String> {
    keyring::Entry::new("galactic_edu", "access_token")
        .set_password(&token)
        .map_err(|e| e.to_string())
}
```

## Desktop Features
| Feature | Implementation |
|---------|---------------|
| Offline lessons | Tauri FS API → disk cache |
| Secure tokens | OS keychain (keyring crate) |
| Auto-update | Tauri Updater plugin |
| Window menu | Tauri menu API |
| Notifications | OS native notifications |
| Deep link | Custom protocol `galactic://` |

## Build Commands
```bash
# Development
npm create tauri-app@latest desktop -- --template react-ts
cd desktop && pnpm install
pnpm tauri dev

# Production build
pnpm tauri build
# → .msi (Windows), .dmg (macOS), .deb/.AppImage (Linux)
```
